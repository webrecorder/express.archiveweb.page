import { ArchiveDB } from "@webrecorder/wabac/src/archivedb";
import { LiveAccess } from "@webrecorder/wabac/src/remoteproxy";
import { SWCollections } from "@webrecorder/wabac/src/swmain";
import { randomId } from "../../../../core/wabac.js/src/utils";


// ===========================================================================
class RecProxy extends ArchiveDB
{
  constructor(config, collLoader) {
    super(config.dbname);

    this.name = config.dbname.slice(3);

    this.collLoader = collLoader;

    this.liveProxy = new LiveAccess(config, true);

    this.pageId = randomId();
    this.isNew = true;
  }

  async getResource(request, prefix, event) {
    const response = await this.liveProxy.getResource(request, prefix);

    let req = request.request;
    if (req.origRequest) {
      req = req.origRequest;
    }

    this.doRecord(event.clientId || event.resultingClientId, response, req);

    return response;
  }

  async doRecord(clientId, response, request) {
    const url = response.url;
    const ts = response.date.getTime();

    const mime = (response.headers.get("content-type") || "").split(";")[0];

    const status = response.status;
    const statusText = response.statusText;

    const respHeaders = Object.fromEntries(response.headers.entries());
    const reqHeaders = Object.fromEntries(request.headers.entries());

    const payload = new Uint8Array(await response.clonedResponse.arrayBuffer());

    const pageId = this.pageId;

    const data = {
      url,
      ts,
      status,
      statusText,
      pageId,
      payload,
      mime,
      respHeaders,
      reqHeaders
    };

    await this.addResource(data);

    await this.collLoader.updateSize(this.name, payload.length, payload.length);

    if (this.isNew && (status < 301 || status >= 400)) {
      await this.addPages([{id: pageId, url, ts}]);
      this.isNew = false;
    }
  }
}

// ===========================================================================
export class RecordingCollections extends SWCollections
{
  async _initStore(type, config) {
    let store;

    switch (type) {
    case "recordingproxy":
      store = new RecProxy(config, this);
      if (store.initing) {
        await store.initing;
      }
      return store;
    }

    return await super._initStore(type, config);
  }
}
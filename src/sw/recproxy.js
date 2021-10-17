import { ArchiveDB } from "@webrecorder/wabac/src/archivedb";
import { LiveAccess } from "@webrecorder/wabac/src/remoteproxy";
import { SWCollections } from "@webrecorder/wabac/src/swmain";


// ===========================================================================
class RecProxy extends ArchiveDB
{
  constructor(config, collLoader) {
    super(config.dbname);

    this.name = config.dbname.slice(3);

    this.collLoader = collLoader;

    this.liveProxy = new LiveAccess(config, true);
  }

  async getResource(request, prefix, event) {
    const response = await this.liveProxy.getResource(request, prefix);

    this.doRecord(event.clientId, event.resultingClientId, response, request.request);

    return response;
  }

  async doRecord(pageId, newPageId, response, request) {
    pageId = pageId || newPageId;

    const url = response.url;
    const ts = response.date.getTime();

    const mime = (response.headers.get("content-type") || "").split(";")[0];

    const status = response.status;
    const statusText = response.statusText;

    const respHeaders = Object.fromEntries(response.headers.entries());
    const reqHeaders = Object.fromEntries(request.headers.entries());

    const payload = new Uint8Array(await response.clonedResponse.arrayBuffer());

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

    // handled via separate API call instead to get title
    // if (this.isNew) {
    //   await this.db.addPages([{id: pageId, url, ts}]);
    //   this.isNew = false;
    // }
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
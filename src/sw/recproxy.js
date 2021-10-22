import { ArchiveDB } from "@webrecorder/wabac/src/archivedb";
import { LiveAccess } from "@webrecorder/wabac/src/remoteproxy";
import { SWCollections } from "@webrecorder/wabac/src/swmain";
import { randomId } from "@webrecorder/wabac/src/utils";
import { postToGetUrl } from "warcio";


// ===========================================================================
class RecProxy extends ArchiveDB
{
  constructor(config, collLoader) {
    super(config.dbname);

    this.name = config.dbname.slice(3);

    this.collLoader = collLoader;

    this.liveProxy = new LiveAccess(config, {cloneResponse: true, allowBody: true});

    this.pageId = randomId();
    this.isNew = true;

    //this.cookie = "";
  }

  async getResource(request, prefix, event) {
    let req;
    
    if (request.method === "POST" || request.method === "PUT") {
      req = request.request.clone();
    } else {
      req = request.request;
    }

    const response = await this.liveProxy.getResource(request, prefix);

    this.cookie = response.headers.get("x-wabac-preset-cookie");

    this.doRecord(event.clientId || event.resultingClientId, response, req);

    return response;
  }

  async doRecord(clientId, response, request) {
    let url = response.url;
    const ts = response.date.getTime();

    const mime = (response.headers.get("content-type") || "").split(";")[0];

    const status = response.status;
    const statusText = response.statusText;

    const respHeaders = Object.fromEntries(response.headers.entries());
    const reqHeaders = Object.fromEntries(request.headers.entries());

    const payload = new Uint8Array(await response.clonedResponse.arrayBuffer());

    const pageId = this.pageId;

    const referrer = request.referrer;

    if (request.method === "POST" || request.method === "PUT") {
      const data = {
        method: request.method,
        postData: await request.text(),
        headers: request.headers,
        url,
      };

      if (postToGetUrl(data)) {
        url = new URL(data.url).href;
        console.log("URL", url);
      }
    }

    const data = {
      url,
      ts,
      status,
      statusText,
      pageId,
      payload,
      mime,
      respHeaders,
      reqHeaders,
      referrer
    };

    await this.addResource(data);

    await this.collLoader.updateSize(this.name, payload.length, payload.length);

    // don't add page for redirects
    if (this.isNew && (status < 301 || status >= 400)) {
      console.log("Referrer", referrer);
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
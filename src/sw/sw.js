
import { SWReplay } from "@webrecorder/wabac/src/swmain";

import { API } from "@webrecorder/wabac/src/api";
import { tsToDate } from "@webrecorder/wabac/src/utils";

import { Downloader } from "./downloader";
import { Signer } from "./keystore";
import { RecordingCollections } from "./recproxy";


// ===========================================================================
class ExtAPI extends API
{
  constructor(...args) {
    super(...args);
  }
  
  get routes() {
    return {
      ...super.routes,
      "downloadPages": "c/:coll/dl",
      "updatePage": ["c/:coll/page", "POST"]
    };
  }

  async handleApi(request, params, event) {
    switch (params._route) {
    case "downloadPages": {
      const coll = await this.collections.loadColl(params.coll);
      if (!coll) {
        return {error: "collection_not_found"};
      }

      const pageQ = params._query.get("pages");
      const pageList = pageQ === "all" ? null : pageQ.split(",");

      const format = params._query.get("format") || "wacz";
      let filename = params._query.get("filename");

      const signer = new Signer();

      const dl = new Downloader({coll, format, filename, pageList, signer});
      return dl.download();
    }

    case "updatePage":
      return await this.updatePageTitle(params.coll, request);

    default:
      return await super.handleApi(request, params, event);
    }
  }

  async updatePageTitle(collId, request) {
    const json = await request.json();
    let {url, ts, title} = json;

    ts = tsToDate(ts).getTime();

    const coll = await this.collections.loadColl(collId);
    if (!coll) {
      return {error: "collection_not_found"};
    }

    //await coll.store.db.init();

    const result = await coll.store.lookupUrl(url, ts);
    if (url !== result.url || ts !== result.ts) {
      return {error: "no_exact_match"};
    }

    const id = coll.store.newPageId();

    await coll.store.addPages([{url, ts, title, id}]);

    return {"added": true};
  }
}

export { ExtAPI };


self.sw = new SWReplay({ApiClass: ExtAPI, CollectionsClass: RecordingCollections});





import { SWReplay } from "@webrecorder/wabac/src/swmain";

import { tsToDate } from "@webrecorder/wabac/src/utils";

import { ExtAPI } from "@webrecorder/archivewebpage/src/sw/api";
import { RecordingCollections } from "./recproxy";
import { Signer } from "@webrecorder/archivewebpage/src/keystore";


// ===========================================================================
class UpdatingAPI extends ExtAPI
{
  constructor(collections) {
    // eslint-disable-next-line no-undef
    super(collections, {softwareString: `Archiveweb.page Express ${__AWP_EXPRESS_VERSION__}, using `});
  }
  
  get routes() {
    return {
      ...super.routes,
      "pageTitle": ["c/:coll/pageTitle", "POST"],
      "publicKey": "publicKey",
    };
  }

  async handleApi(request, params, event) {
    switch (params._route) {
    case "pageTitle":
      return await this.updatePageTitle(params.coll, request);

    case "publicKey":
      return await this.getPublicKey();

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

    if (!result) {
      return {error: "page_not_found"};
    }

    // drop to second precision for comparison
    const roundedTs = Math.floor(result.ts / 1000) * 1000;
    if (url !== result.url || ts !== roundedTs) {
      return {error: "no_exact_match"};
    }

    const page = await coll.store.db.getFromIndex("pages", "url", url);
    if (!page) {
      return {error: "page_not_found"};
    }
    page.title = title;
    await coll.store.db.put("pages", page);

    return {"added": true};
  }

  async getPublicKey() {
    const signer = new Signer();
    const keys = await signer.loadKeys();
    if (!keys || !keys.public) {
      return {};
    } else {
      return {publicKey: keys.public};
    }
  }
}

export { UpdatingAPI };


// const defaultConfig = {
//   injectScripts: ["assets/behaviors.js"],
// };

self.sw = new SWReplay({ApiClass: UpdatingAPI, CollectionsClass: RecordingCollections});




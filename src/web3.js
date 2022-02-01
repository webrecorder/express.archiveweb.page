import { Web3Storage } from "web3.storage";

// eslint-disable-next-line no-undef
const TOKEN = __TOKEN__;

const RWP_PREFIX = "https://cdn.jsdelivr.net/npm/replaywebpage@1.5.7/";

import { create as IPFSCreate } from "ipfs-core";
import { CarWriter } from "@ipld/car";


// ===========================================================================
export class Web3Uploader
{
  constructor(apikey) {
    const token = apikey || TOKEN;
    this.web3 = new Web3Storage({token});
  }

  async uploadWACZ(url, ts, waczUrl) {
    const files = [
      this.createIndex(url, ts),
      await this.fetchFile("replay/sw.js", RWP_PREFIX + "sw.js"),
      await this.fetchFile("ui.js", RWP_PREFIX + "ui.js"),
      await this.fetchFile("webarchive.wacz", waczUrl),
    ];

    const cid = await this.web3.put(files);
    console.log("cid: " + cid);
    return cid;
  }

  createIndex(url, ts) {
    console.log(ts);
    const index = `\
<!doctype html>
<html class="no-overflow">
<head>
  <title>ReplayWeb.page</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="./ui.js"></script>
  <style>
    html, body, replay-web-page {
      width: 100%;
      height: 100%;
      overflow: hidden;
      margin: 0px;
      padding: 0px;
    }
  </style>
</head>
<body>
  <replay-web-page deepLink="true" noSandbox="true" url="${url}" ${ts ? `ts="${ts}"` : ""} embed="default" source="./webarchive.wacz"></replay-web-page>
</body>
</html>
`;
    const blob = new Blob([index], {type : "text/html"});
    return new NamedStream("index.html", blob.stream());
  }

  async fetchFile(name, url) {
    const response = await fetch(url);
    return new NamedStream(name, response.body);
  }
}


// ===========================================================================
class NamedStream
{
  constructor(name, rs) {
    this.name = name;
    this.rs = rs;
  }

  stream() {
    return this.rs;
  }
}


// ===========================================================================
export class URLIndexWrapper
{
  constructor() {
    this.urlindex = null;

    this.ipfs = null;
  }

  async init(root) {
    if (!this.ipfs) {
      this.ipfs = await IPFSCreate();
    }

    const { storage, URLIndex } = window.urlindex;

    const store = new storage.IPFSStorage(this.ipfs);
    this.urlindex = new URLIndex(store);

    if (root) {
      await this.urlindex.loadExisting(root);
      return root;
    } else {
      await this.urlindex.createNew({ desc: "url index" });

      return await this.uploadCarFile() || root;
    }
  }

  async add(params) {
    const newroot = await this.urlindex.add(params);
    return await this.uploadCarFile(newroot);
  }

  async query(params) {
    if (!this.urlindex) {
      return [];
    }
    return await this.urlindex.query(params);
  }

  async uploadCarFile(root) {
    if (!root) {
      root = this.urlindex.rootCid;
    }

    const body = await this.serializeToCar();
    const method = "POST";
    const headers = {
      "Content-Type": "application/car",
      "Authorization": `Bearer ${TOKEN}`
    };

    const resp = await fetch("https://api.web3.storage/car", {method, body, headers});

    if (resp.status === 200) {
      return root.toString();
    }
  }

  async serializeToCar() {
    const { writer, out } = await CarWriter.create([this.urlindex.root.block.cid]);
  
    const storage = this.urlindex.storage;

    async function readAll(out) {
      const chunks = [];
      let size = 0;

      for await (const bytes of out) {
        chunks.push(bytes);
        size += bytes.length;
      }

      if (chunks.length === 1) {
        return chunks[0];
      }

      const buffer = new Uint8Array(size);

      let offset = 0;
    
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.byteLength;
      }
    
      return buffer;
    }
    const p = readAll(out);
  
    for (const cid of storage.cids) {
      const block = await storage.get(cid);
      await writer.put(block);
    }
  
    await writer.close();
    return await p;
  }
}

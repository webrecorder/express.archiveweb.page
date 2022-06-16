import { Web3Storage } from "web3.storage";

// eslint-disable-next-line no-undef
const TOKEN = __TOKEN__;

// eslint-disable-next-line no-undef
const RWP_PREFIX = __RWP_PREFIX__;


// ===========================================================================
export class Web3Uploader
{
  constructor(apikey) {
    const token = apikey || TOKEN;
    this.web3 = new Web3Storage({token});
  }

  async uploadWACZ(url, ts, waczUrl, onStoredChunk) {
    const files = [
      this.createIndex(url, ts),
      await this.fetchFile("replay/sw.js", RWP_PREFIX + "sw.js"),
      await this.fetchFile("ui.js", RWP_PREFIX + "ui.js"),
      await this.fetchFile("webarchive.wacz", waczUrl),
    ];

    const cid = await this.web3.put(files, {onStoredChunk});
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

import { Web3Storage } from "web3.storage";


const TOKEN = __TOKEN__;

export class Web3Uploader
{
  constructor(apikey) {
    const token = apikey || TOKEN;
    this.web3 = new Web3Storage({token});
    this.rwpPrefix = "https://replayweb.page/";
  }

  async uploadWACZ(waczUrl) {
    const files = [
      this.createIndex(),
      await this.fetchFile("sw.js", this.rwpPrefix + "sw.js"),
      await this.fetchFile("ui.js", this.rwpPrefix + "ui.js"),
      await this.fetchFile("webarchive.wacz", waczUrl),
    ];

    const cid = await this.web3.put(files);
    console.log("cid: " + cid);
    return cid;
  }

  createIndex() {
    const index = `\
<!doctype html>
<html class="no-overflow">
<head>
  <title>ReplayWeb.page</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="./ui.js"></script>
</head>
<body>
  <replay-app-main source="./webarchive.wacz"></replay-app-main>
</body>
</html>`;
  const blob = new Blob([index], {type : 'text/html'});
  return new NamedStream("index.html", blob.stream());
  }

  async fetchFile(name, url) {
    const response = await fetch(url);
    return new NamedStream(name, response.body);
  }
}

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
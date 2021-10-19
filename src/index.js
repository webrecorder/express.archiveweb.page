import "tailwindcss/tailwind.css";

import { LitElement, html } from "lit";
import prettyBytes from "pretty-bytes";
import { Web3Uploader } from "./web3";

export default class LiveWebProxy extends LitElement
{
  constructor() {
    super();
    this.archivePrefix = "https://web.archive.org/web/";
    this.proxyPrefix = "https://oldweb.today/proxy/";

    this.isLive = true;

    this.lastUrl = null;
    this.lastTs = null;

    this.size = 0;
    this.collReady = false;
    this.collAwait = null;

    this.hashUpdate = false;
  }

  static get properties() {
    return {
      url: { type: String },
      ts: { type: String },

      isLive: { type: Boolean },
      loading: { type: Boolean },
      uploading: { type: Boolean },
      
      opts: { type: Object },
      inited: { type: Boolean },
      iframeUrl: { type: String },

      collReady: { type: Boolean },

      collId: { type: String },
      size: { type: Number },

      cidLink: { type: String },

      archivePrefix: { type: String },
      proxyPrefix: { type: String }
    };
  }

  firstUpdated() {
    window.addEventListener("message", (event) => this.onReplayMessage(event));
    this.initSW();

    const onHashChange = () => {
      // guard against setting again
      if (this.hashUpdate) {
        this.hashUpdate = false;
        return;
      }
      const m = window.location.hash.slice(1).match(/\/?(?:([\d]+)\/)?(.*)/);
      if (m) {
        this.ts = m[1] || "";
        this.url = m[2] || "https://example.com/";
      }
    };

    window.addEventListener("hashchange", () => onHashChange());
    onHashChange();

    window.addEventListener("beforeunload", () => {
      this.deleteColl(this.collId);
    });
  }

  async updateSize() {
    const resp = await fetch(`w/api/c/${this.collId}`);
    const json = await resp.json();
    this.size = json.size;
  }

  updated(changedProps) {
    if (changedProps.has("url") || changedProps.has("ts")) {
      if (this.url && (this.url !== this.actualUrl || changedProps.has("ts"))) {
        this.initCollection();
      }
    }
  }

  async initSW() {
    const scope = "./";

    await navigator.serviceWorker.register("./sw.js", {scope});

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data.msg_type === "collAdded" && event.data.name === this.collId && this.collAwait) {
        this.collAwait();
      }
    });
  }

  initCollection() {
    const baseUrl = new URL(window.location);
    baseUrl.hash = "";

    this.deleteColl(this.collId);

    this.collId = randomId();
    this.cidLink = null;
    this.uploading = false;

    const msg = {
      msg_type: "addColl",
      name: this.collId,
      type: "recordingproxy",
      file: {"sourceUrl": `proxy:${this.proxyPrefix}`},
      skipExisting: false,
      extraConfig: {
        "prefix": this.proxyPrefix, 
        "isLive": false,
        "archivePrefix": this.archivePrefix,
        "baseUrl": baseUrl.href,
        "baseUrlHashReplay": true,
        "recording": true,
        "noPostToGet": true
      },
    };

    //this.dispatchEvent(new CustomEvent("load-started"));
    this.iframeUrl = `/w/${this.collId}/${this.ts}mp_/${this.url}`;

    this.hashUpdate = true;
    window.location.hash = this.ts ? `#${this.ts}/${this.url}` : `#${this.url}`;

    this.collReady = false;
    this.loading = true;

    const p = new Promise((resolve) => {
      this.collAwait = resolve;
    }).then(() => this.collReady = true);

    if (!navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        navigator.serviceWorker.controller.postMessage(msg);
      });
    } else {
      navigator.serviceWorker.controller.postMessage(msg);
    }
  }

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="flex justify-center text-2xl">DWeb Archive Page</div>
      
      <form @submit="${this.onUpdateUrlTs}" class="grid grid-cols-1 gap-3">
        <input class="rounded w-full" id="url" type="text" placeholder="Enter URL To load" .value="${this.url}">
        <div>
          <label for="live">
            <input id="live" name="islive" class="mr-1" type="radio" ?checked="${this.isLive}" @click="${() => this.isLive = true}">Live
          </label>
          <label for="ia" class="pt-4">
            <input id="ia" name="islive" class="mr-1 ml-4" type="radio" ?checked="${!this.isLive}" @click="${() => this.isLive = false}">Archived at: (via Internet Archive)
            <input id="ts" class="text-sm rounded rounded-md" type="text" .value="${tsToDateMin(this.ts || "19960101")}" placeholder="YYYY-MM-DD hh:mm:ss" ?disabled="${this.isLive}"></input>
          </label>
          <button type="submit" class="border rounded p-2 bg-blue-300">Load</button>
        </div>

        <div class="flex items-center justify-between">
          ${this.loading ? html`Loading...` : html`
          <div class="mb-2">Sharable Link:
          &nbsp;${this.cidLink ? html`
          <a class="text-blue-800" target="_blank" href="${this.cidLink}">${this.cidLink}</a>` : html`
          <button class="border rounded bg-green-300 p-2" @click="${this.onUpload}" ?disabled="${this.uploading}">${this.uploading ? "Uploading..." : "Upload to Web3.Storage (IPFS + Filecoin)"}</button>
          `}
          </div>
          <div class="mb-2" id="status">
            Size: <b>${prettyBytes(this.size || 0)}</b>
            <a href="w/api/c/${this.collId}/dl?pages=all&format=wacz" class="border p-2 rounded bg-blue-300">Download Archive</a>
          </div>`}
        </div>
      </form>

      ${this.collReady && this.iframeUrl ? html`
      <iframe sandbox="allow-downloads allow-modals allow-orientation-lock allow-pointer-lock\
         allow-popups allow-presentation allow-scripts allow-same-origin"
      class="border border-solid border-black" src="${this.iframeUrl}"
      @load="${this.onFrameLoad}" allow="autoplay 'self'; fullscreen" allowfullscreen
      ></iframe>` : ``}
    `;
  }

  onUpdateUrlTs(event) {
    event.preventDefault();

    this.url = this.renderRoot.querySelector("#url").value;

    if (this.isLive) {
      this.ts = "";
    } else {
      this.ts = this.renderRoot.querySelector("#ts").value.replace(/[^\d]/g, "");
    }
  }

  onFrameLoad(event) {
    try {
      //const iframe = this.renderRoot.querySelector("iframe");
      const loc = event.currentTarget.contentWindow.WB_wombat_location;
      if (loc) {
        this.actualUrl = loc.url;
        this.updateSize();
        this.loading = false;
      } else {
        this.actualUrl = null;
      }
    } catch(e) {
      console.log(e);
      this.actualUrl = null;
    }

    //this.dispatchEvent(new CustomEvent("load-finished", {detail}));
  }

  onReplayMessage(event) {
    const iframe = this.renderRoot.querySelector("iframe");

    if (iframe && event.source === iframe.contentWindow) {
      if (event.data.wb_type === "load") {
        const ts = event.data.ts;
        const url = event.data.url;
        const title = event.data.title;
        //this.clearLoading(iframe.contentWindow);

        if (this.lastTs !== ts && this.lastUrl !== url) {
          const req = {url, ts, title};
          console.log(title, ts, url);

          if (title && title !== url) {
            fetch(`w/api/c/${this.collId}/pageTitle`, {method: "POST", body: JSON.stringify(req)});
          }

          this.lastTs = ts;
          this.lastUrl = url;
        }

        this.updateSize();
      }
    }
  }

  async onUpload() {
    this.uploading = true;
    const storage = new Web3Uploader();
    const cid = await storage.uploadWACZ(`w/api/c/${this.collId}/dl?pages=all&format=wacz`);
    this.cidLink = `https://dweb.link/ipfs/${cid}/`;
    this.uploading = false;
  }

  async deleteColl(collId) {
    if (collId) {
      await fetch(`w/api/c/${collId}`, {method: "DELETE"});
    }
  }
}

function randomId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function tsToDateMin(ts) {
  if (!ts) {
    return "";
  }

  if (ts.length < 14) {
    ts += "00000101000000".substr(ts.length);
  }

  const datestr = (ts.substring(0, 4) + "-" +
    ts.substring(4, 6) + "-" +
    ts.substring(6, 8) + " " +
    ts.substring(8, 10) + ":" +
    ts.substring(10, 12) + ":" +
    ts.substring(12, 14));

  return datestr;
};

customElements.define("live-web-proxy", LiveWebProxy);

import "tailwindcss/tailwind.css";
import "./shoelace";

import { LitElement, html } from "lit";
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
        this.isLive = !this.ts;
        this.initCollection();
      }
    };

    window.addEventListener("hashchange", () => onHashChange());
    onHashChange();

    window.addEventListener("beforeunload", () => {
      this.deleteColl(this.collId);
    });

    setInterval(() => this.updateSize(), 5000);
  }

  async updateSize() {
    if (!this.collId) {
      return;
    }
    const resp = await fetch(`w/api/c/${this.collId}`);
    const json = await resp.json();
    this.size = json.size;
  }

  // updated(changedProps) {
  //   if (changedProps.has("url") || changedProps.has("ts")) {
  //     if (this.url && (this.url !== this.actualUrl || changedProps.has("ts"))) {
  //       this.initCollection();
  //     }
  //   }
  // }

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

    new Promise((resolve) => {
      this.collAwait = resolve;
    }).then(() => {this.collReady = true; this.hashUpdate = false; });

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
      <style>
      :root {
        --sl-color-primary-600: var(--sl-color-primary-500);
        --sl-color-success-600: var(--sl-color-success-500);
      }
      </style>
      <div class="flex absolute mt-1 right-0 text-xs">A project by&nbsp;<a target="_blank" href="https://webrecorder.net/"><img class="h-4" src="./assets/wrLogo.png"></div></a>
      <div class="flex justify-center m-2 text-2xl">Archive a Single Web Page Directly in your Browser!</div>

      <sl-form @sl-submit="${this.onUpdateUrlTs}" class="grid grid-cols-1 gap-3 mb-4">
        <div class="flex">
          ${this.loading ? html`
          <sl-button style="width: 48px" class="ml-1" type="default" loading="default"></sl-button>
          ` : html`
          <sl-button @click="${this.onRefresh}" style="width: 48px" class="mr-1" type="default">
            <sl-icon class="text-2xl align-middle" name="arrow-clockwise"></sl-icon>
          </sl-button>`}

          <sl-input class="rounded w-full" id="url" placeholder="Enter URL To load" .value="${this.url}">
          </sl-input>
        </div>

        <div class="flex flex-wrap mt-2">
          <sl-radio-group class="flex" fieldset label="Load From:">
            <sl-radio class="mr-1" ?checked="${this.isLive}"
            @sl-change="${() => this.isLive = true}">Live Web Page</sl-radio>

            <div class="flex items-baseline">
              <sl-radio class="mr-1" ?checked="${!this.isLive}"
              @sl-change="${() => this.isLive = false}">Archived on:</sl-radio>

              <div class="flex flex-col mt-2">
                <sl-input id="ts" class="text-sm rounded rounded-md"
                .value="${tsToDateMin(this.ts || "19960101")}" placeholder="YYYY-MM-DD hh:mm:ss"
                ?disabled="${this.isLive}"></sl-input>
                <span class="text-xs">(via Internet Archive)</span>
              </div>
            </div>
          </sl-radio-group>


          ${this.loading ? html`
            <span class="flex items-center ml-4 mt-4">
              <sl-spinner class="text-4xl mr-4"></sl-spinner>Loading, Please wait...
            </span>` : html`

            <sl-radio-group class="flex" fieldset style="max-width: 500px" label="Share to IPFS (using web3.storage)">
              <div class="mb-2">Sharable Link:
                &nbsp;${this.cidLink ? html`
                  <a class="text-blue-800 font-bold break-all" target="_blank" href="${this.cidLink}">${this.cidLink}</a>` : html`

                  ${this.uploading ? html`
                  <sl-button disabled type="success">
                  <sl-spinner style="--indicator-color: currentColor"></sl-spinner>
                  Uploading...</sl-button>` : html`
                  <sl-button type="success" @click="${this.onUpload}">
                  <sl-icon class="text-lg mr-1" name="share-fill"></sl-icon>
                  Share to IPFS</sl-button>
                  `}

                `}</div>

                <details class="w-full">
                  <summary>Advanced Options</summary>
                  <sl-input size="small" class="" id="apikey" type="text"
                  placeholder="Custom web3.storage API key"></sl-input>
                </details>

              </div>
            </sl-radio-group>

            <sl-radio-group class="flex" fieldset label="Archive Info">
              <sl-button type="primary" href="w/api/c/${this.collId}/dl?pages=all&format=wacz" target="_blank">
              <sl-icon class="text-lg mr-1" name="file-earmark-arrow-down"></sl-icon>Download Archive</sl-button>
              <div class="mt-2">Size Loaded: <b><sl-format-bytes value="${this.size || 0}"></sl-format-bytes></b></div>
            </sl-radio-group>`}

        </div>
      </sl-form>

      ${this.collReady && this.iframeUrl ? html`
      <iframe sandbox="allow-downloads allow-modals allow-orientation-lock allow-pointer-lock\
         allow-popups allow-presentation allow-scripts allow-same-origin"
      class="border border-solid border-black" src="${this.iframeUrl}"
      @load="${this.onFrameLoad}" allow="autoplay 'self'; fullscreen" allowfullscreen
      ></iframe>` : ""}
    `;
  }

  onUpdateUrlTs(event, always) {
    if (event) {
      event.preventDefault();
    }

    const url = this.renderRoot.querySelector("#url").value;
    let ts;

    if (this.isLive) {
      ts = "";
    } else {
      ts = this.renderRoot.querySelector("#ts").value.replace(/[^\d]/g, "");
    }

    // determine if an update is needed
    // if url is set and either url or ts have changed or always is set
    const changed = (url && (always || url !== this.actualUrl || ts !== this.ts));

    this.ts = ts;
    this.url = url;

    if (changed) {
      this.initCollection();
    }
  }

  onRefresh() {
    this.onUpdateUrlTs(null, true);
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
          //console.log(title, ts, url);

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
    
    const apiKeyInput = this.renderRoot.querySelector("#apikey");
    const apiKey = apiKeyInput && apiKeyInput.value;

    const storage = new Web3Uploader(apiKey);
    const cid = await storage.uploadWACZ(this.url, this.lastTs, `w/api/c/${this.collId}/dl?pages=all&format=wacz`);
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
}

customElements.define("live-web-proxy", LiveWebProxy);

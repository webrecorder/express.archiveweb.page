import { LitElement, html } from "lit";
import prettyBytes from "pretty-bytes";

export default class LiveWebProxy extends LitElement
{
  constructor() {
    super();
    this.inited = false;
    this.archivePrefix = "https://web.archive.org/web/";
    this.proxyPrefix = "https://oldweb.today/proxy/";

    this.collId = randomId();
    this.lastUrl = null;
    this.lastTs = null;

    this.size = 0;
  }

  static get properties() {
    return {
      url: { type: String },
      ts: { type: String },
      opts: { type: Object },
      inited: { type: Boolean },
      iframeUrl: { type: String },
      size: { type: Number },

      archivePrefix: { type: String },
      proxyPrefix: { type: String }
    };
  }

  firstUpdated() {
    window.addEventListener("message", (event) => this.onReplayMessage(event));
    this.initSW();

    const update = () => {
      const m = window.location.hash.slice(1).match(/\/?(?:([\d]+)\/)?(.*)/);
      if (m) {
        this.ts = m[1] || "";
        this.url = m[2] || "http://example.com/";
      }
    };

    window.addEventListener("hashchange", () => update());
    update();

    setInterval(() => this.updateSize(), 5000);
  }

  async updateSize() {
    const resp = await fetch(`w/api/c/${this.collId}`);
    const json = await resp.json();
    this.size = json.size;
  }

  updated(changedProps) {
    if (changedProps.has("url") || changedProps.has("ts")) {
      if (this.url && (this.url !== this.actualUrl || changedProps.has("ts"))) {
        this.dispatchEvent(new CustomEvent("load-started"));
        this.iframeUrl = `/w/${this.collId}/${this.ts}mp_/${this.url}`;
      }
    }
  }

  async initSW() {
    const scope = "./";

    await navigator.serviceWorker.register("./sw.js", {scope});

    navigator.serviceWorker.addEventListener("message", () => {
      this.inited = true;
    });

    const baseUrl = new URL(window.location);
    baseUrl.hash = "";

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
      },
    };

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
    if (!this.inited || !this.iframeUrl) {
      return html``;
    }

    return html`
      <div>DWeb Archive Page</div>
      
      <div><input id="url" type="text" placeholder="URL" .value="${this.url}"></div>

      <div id="status">Uncompressed Size: ${prettyBytes(this.size || 0)}</div>

      <iframe sandbox="allow-downloads allow-modals allow-orientation-lock allow-pointer-lock\
         allow-popups allow-presentation allow-scripts allow-same-origin"
      class="native-frame" src="${this.iframeUrl}"
      @load="${this.onFrameLoad}" allow="autoplay 'self'; fullscreen" allowfullscreen
      ></iframe> 

      <a href="w/api/c/${this.collId}/dl?pages=all&format=wacz">Download Archive!</a>
    `;
  }

  onFrameLoad(event) {
    const detail = {};

    try {
      //const iframe = this.renderRoot.querySelector("iframe");
      detail.url = event.currentTarget.contentWindow.WB_wombat_location.href;
      this.actualUrl = detail.url;
    } catch(e) {
      console.log(e);
    }

    this.dispatchEvent(new CustomEvent("load-finished", {detail}));
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
  
          fetch(`w/api/c/${this.collId}/page`, {method: "POST", body: JSON.stringify(req)});

          this.lastTs = ts;
          this.lastUrl = url;
        }
      }
    }

    if (this.title) {
      const detail = {title: this.title, replayTitle: true};
      this.dispatchEvent(new CustomEvent("update-title", {bubbles: true, composed: true, detail}));
    }
  }
}

function randomId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

customElements.define("live-web-proxy", LiveWebProxy);

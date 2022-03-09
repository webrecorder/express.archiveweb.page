import "tailwindcss/tailwind.css";
import "./shoelace";

import { LitElement, html } from "lit";
import { Web3Uploader } from "./web3";
import { SimpleCrawler } from "./simplecrawl";

const VERSION = __AWP_EXPRESS_VERSION__;


// ===========================================================================
export default class LiveWebRecorder extends LitElement
{
  constructor() {
    super();
    this.archivePrefix = "https://web.archive.org/web/";
    this.proxyPrefix = "https://wabac-cors-proxy.webrecorder.workers.dev/proxy/";

    this.isLive = true;

    this.lastUrl = null;
    this.lastTs = null;
    this.lastTitle = null;

    this.size = 0;
    this.uploadProgress = 0;

    this.collReady = false;
    this.collAwait = null;

    this.hashUpdate = false;

    this.publicKey = null;

    this.crawler = null;
    this.crawlState = null;
    this.crawlSameOriginOnly = false;
    this.crawlSelector = "a[href]";

    this.fullscreen = false;
    this.showAbout = false;
    this.showPublicKey = false;
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
      uploadProgress: { type: Number },

      cidLink: { type: String },

      archivePrefix: { type: String },
      proxyPrefix: { type: String },

      publicKey: { type: String },

      fullscreen: { type: Boolean },
      showAbout: { type: Boolean },
      showPublicKey: { type: Boolean },

      crawlState: { type: Object },
      crawlSameOriginOnly: { type: Boolean },
      crawlSelector: { type: String },
    };
  }

  firstUpdated() {
    document.addEventListener('fullscreenchange', () => {
      this.fullscreen = !!document.fullscreenElement;
    });

    this.showAbout = window.location.search === "?about";

    this.getPublicKey();

    window.addEventListener("message", (event) => this.onReplayMessage(event));
    this.initSW();

    const onHashChange = () => {
      // guard against setting again
      if (this.hashUpdate) {
        this.hashUpdate = false;
        return;
      }
      const m = window.location.hash.slice(1).match(/\/?(?:([\d]+)\/)?(.*)/);
      
      if (!m) {
        return;
      }

      this.handleHashChange(m);
    };

    window.addEventListener("hashchange", () => onHashChange());
    onHashChange();

    window.addEventListener("beforeunload", () => {
      this.deleteColl(this.collId);
    });

    setInterval(() => this.updateSize(), 5000);
  }

  async getPublicKey() {
    try {
      const resp = await fetch("/w/api/publicKey");
      const json = await resp.json();
      if (json.publicKey) {
        this.publicKey = json.publicKey;
      }
    } catch (e) {
      console.error(e);
    }
  }

  handleHashChange(m) {
    this.ts = m[1] || "";
    this.url = m[2] || "https://example.com/";
    this.isLive = !this.ts;
    this.initCollection();
  }

  async updateSize() {
    if (!this.collId) {
      return;
    }
    const resp = await fetch(`w/api/c/${this.collId}`);
    const json = await resp.json();
    this.size = json.size;
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
    this.crawler = null;
    this.crawlState = null;

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

  renderCrawlInfo() {
    const status = this.crawlState && this.crawlState.status || "not_started";

    if (status === "not_started") {
      return html`<sl-button @click="${this.onCrawlStart}">Crawl Links</sl-button>`;
    }

    switch (status) {
      case "paused":
        return html`
        <sl-icon-button class="border" @click="${this.onCrawlStep}" name="play-fill" title="Next Page" label="Next Page">
        </sl-icon-button>
        <sl-icon-button class="border" @click="${this.onCrawlPauseToggle}" name="skip-forward-fill" title="Run Crawl" label="Run Crawl">
        </sl-icon-button>
        <div class="mt-2">Status: <b>Crawled ${this.crawlState.count} of ${this.crawlState.total}</div>
        `;

      case "running":
      case "stepping":
        return html`
        <sl-icon-button class="border" @click="${this.onCrawlPauseToggle}" name="pause" label="Pause" title="Pause">
        </sl-icon-button>
        <sl-icon-button class="border" @click="${this.onCrawlCancel}" name="x-lg" label="Cancel" title="Cancel">
        </sl-icon-button>
        <div class="mt-2">Status: <b>Crawled ${this.crawlState.count} of ${this.crawlState.total}</div>
        `;

      case "done":
        return html`
        <div class="mt-2">Status: <b>Crawled ${this.crawlState.count} of ${this.crawlState.total}</div>
        <span>Done!</span>
        `;
    }
  }

  renderControls() {
    return html`
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

      <sl-radio-group class="flex" fieldset label="Simple Crawling">
        <details class="w-full mb-2">
          <summary>Options</summary>
          <span class="text-xs">Select: <sl-input size="small" .value="${this.crawlSelector}" @sl-change="${this.onCrawlSetSelector}"></sl-input>
          </span>
          <sl-checkbox size="small" ?checked="${this.crawlSameOriginOnly}"
            @sl-change="${this.onCrawlToggleOriginOnly}"><span class="text-xs">Same-Domain Links Only</span>
          </sl-checkbox>
        </details>
        ${this.renderCrawlInfo()}
      </sl-radio-group>

      <sl-radio-group class="flex" fieldset label="Archive Info">
        <div class="mb-2">Size Loaded: <b><sl-format-bytes value="${this.size || 0}"></sl-format-bytes></b></div>
        <sl-button type="primary" href="w/api/c/${this.collId}/dl?pages=all&format=wacz" @click="${this.onDownload}" target="_blank">
        <sl-icon class="text-lg mr-1" name="file-earmark-arrow-down"></sl-icon>Download Archive</sl-button>
      </sl-radio-group>

      <sl-radio-group class="flex" fieldset style="max-width: 500px" label="Share">
        <details class="w-full mb-2">
          <summary>Options</summary>
          <sl-input size="small" class="" id="apikey" type="text"
          placeholder="Custom web3.storage API key"></sl-input>
        </details>
        <div class="mb-2">${this.cidLink ? html`
            Sharable Link:&nbsp;
            <a class="text-blue-800 font-bold break-all" target="_blank" href="${this.cidLink}">${this.cidLink}</a>
            <sl-button size="small" @click="${() => this.cidLink = null}">Reset</sl-button>` : html`
            ${this.uploading ? html`
            <sl-button disabled type="success">
            <sl-spinner style="--indicator-color: currentColor"></sl-spinner>
            Uploading...</sl-button>
            ${this.uploadProgress > 0 ? html`
            <sl-progress-bar class="mt-2" value="${this.uploadProgress}" style="--height: 6px;"></sl-progress-bar>` : ``}
            ` : html`

            <sl-button type="success" @click="${this.onUpload}">
            <sl-icon class="text-lg mr-1" name="share-fill"></sl-icon>
            Share to IPFS</sl-button>
            <div class="text-xs">(via <a target="_blank" href="https://web3.storage">web3.storage</a>)</div>
            `}

          `}
        </div>
      </sl-radio-group>
      `}

      <div class="mt-4 flex flex-row-reverse flex-auto">
        <div class="flex flex-col">
          <div class="mt-1 flex right-0 text-xs project-by">
            A project by&nbsp;<a target="_blank" href="https://webrecorder.net/">
            <img class="h-4" src="./assets/wrLogo.png"></a>
          </div>
          <div class="mt-2 text-right"><a class="no-underline" @click="${this.onShowAbout}" href="?about">About</a></div>
          <div class="mt-2 text-right"><a class="no-underline" @click="${this.onShowPublicKey}" href="">Public Key</a></div>
          <div class="mt-2 text-right"><a class="no-underline" target="_blank" href="https://github.com/webrecorder/express.archiveweb.page">
          <sl-icon class="mr-1" name="github"></sl-icon>Source</a></div>
        </div>
      </div>


  </div>
    `;
  }

  renderContent() {
    return html`
    <sl-form @sl-submit="${this.onUpdateUrlTs}" class="grid grid-cols-1 gap-3 mb-4 mt-2">
    <div class="flex">
      <sl-button @click="${this.onFullScreenToggle}" style="width: 48px" class="mr-1" type="default">
        <sl-icon class="text-2xl align-middle" name="${this.fullscreen ? 'fullscreen-exit' : 'arrows-fullscreen'}"></sl-icon>
      </sl-button>
      ${this.loading ? html`
      <sl-button style="width: 48px" class="ml-1" type="default" loading="default"></sl-button>
      ` : html`
      <sl-button @click="${this.onRefresh}" style="width: 48px" class="mr-1" type="default">
        <sl-icon class="text-2xl align-middle" name="arrow-clockwise"></sl-icon>
      </sl-button>
      `}

      <sl-input class="rounded w-full" id="url" placeholder="Enter URL To load" .value="${this.url}">
      </sl-input>
    </div>

    ${this.renderControls()}
  </sl-form>

  ${this.collReady && this.iframeUrl ? html`
  <iframe sandbox="allow-downloads allow-modals allow-orientation-lock allow-pointer-lock\
    allow-popups allow-presentation allow-scripts allow-same-origin"
  class="border border-solid border-black" src="${this.iframeUrl}"
  @load="${this.onFrameLoad}" allow="autoplay 'self'; fullscreen" allowfullscreen
  ></iframe>` : ""}
    `
  }

  render() {
    return html`
      <style>
      :root {
        --sl-color-primary-600: var(--sl-color-primary-500);
        --sl-color-success-600: var(--sl-color-success-500);
        background-color: white;
      }

      sl-textarea::part(textarea) {
        background: var(--sl-color-neutral-200);
      }

      .project-by {
        margin-right: -0.5em
      }

      </style>

      ${!this.fullscreen ? html`
      <div class="flex justify-center mt-2 text-2xl">ArchiveWeb.page Express</div>
      <div class="flex justify-center text-sm italic">Instant archiving of public web pages</div>
      ` : ``}

      ${this.renderContent()}
      ${this.renderAbout()}
      ${this.renderPublicKey()}
    `;
  }

  onDownload(e) {
    setTimeout(() => this.getPublicKey(), 1000);
    return true;
  }

  onShowResult(result, value) {
    result.show = value;
    this.searchResults = [...this.searchResults];
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

  async onReplayMessage(event) {
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

          this.lastTs = ts;
          this.lastUrl = url;
          this.lastTitle = title;

          this.url = url;

          if (title && title !== url) {
            try {
              await fetch(`w/api/c/${this.collId}/pageTitle`, {method: "POST", body: JSON.stringify(req)});
            } catch (e) {
              console.warn(e);
            }
          }
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
    const url = this.url;
    const ts = this.lastTs;
    const title = this.lastTitle;
    this.uploadProgress = 0;
    const cid = await storage.uploadWACZ(url, ts, `w/api/c/${this.collId}/dl?pages=all&format=wacz`, (size) => {
      this.uploadProgress = this.size ? Math.round(100.0 * size / this.size) : 0;
    });
    this.cidLink = `https://dweb.link/ipfs/${cid}/`;

    this.uploading = false;
  }

  onFullScreenToggle() {
    if (!this.fullscreen) {
      this.requestFullscreen();
      this.fullscreen = true;
    } else {
      document.exitFullscreen();
      this.fullscreen = false;
    }
  }

  async deleteColl(collId) {
    if (collId) {
      await fetch(`w/api/c/${collId}`, {method: "DELETE"});
    }
  }

  onCrawlStart() {
    this.crawler = new SimpleCrawler(this, this.renderRoot.querySelector("iframe"));
    this.crawler.start(this.url, this.crawlSelector, this.crawlSameOriginOnly);
  }

  onCrawlPauseToggle() {
    if (this.crawler) {
      this.crawler.togglePause();
    }
  }

  onCrawlStep() {
    if (this.crawler) {
      this.crawler.togglePause(true);
    }
  }

  onCrawlCancel() {
    if (this.crawler) {
      this.crawler.status = "not_started";
    }
    this.crawler = null;
    this.crawlState = null;
  }

  onCrawlToggleOriginOnly(e) {
    this.crawlSameOriginOnly = e.currentTarget.checked;
    if (this.crawlState) {
      this.crawlState = {...this.crawlState, status: "not_started"};
    }
  }

  onCrawlSetSelector(e) {
    this.crawlSelector = e.currentTarget.value;
    if (this.crawlState) {
      this.crawlState = {...this.crawlState, status: "not_started"};
    }
  }

  onShowAbout(e) {
   e.preventDefault();
   this.showAbout = true;
  }

  onShowPublicKey(e) {
    e.preventDefault();
    this.showPublicKey = true;
   }

  renderAbout() {
    return html`
    <sl-dialog @sl-hide="${() => this.showAbout = false}" label="About ArchiveWeb.page Express" ?open="${this.showAbout}">
    <p class="text-xs">v${VERSION}</p>
    <p class="mt-2">ArchiveWeb.page Express is a streamlined browser-based archiving system. The full <a href="https://archiveweb.page">ArchiveWeb.page</a> requires either
    an extension or desktop app, while the express version runs entirely in the browser.</a>

    <h2 class="mt-6">How it Works</h2>
    <p class="mt-2">To support loading external content, all data is routed via a proxy running as a Cloudflare Worker.</p>

    <p class="mt-2">The <a target="_blank" href="https://github.com/webrecorder/wabac.js">wabac.js</a> service worker is used to rewrite and render all content in an iframe."</p>
    
    <p class="mt-2">Content for each page is stored in the browser, and the session is cleared on a full reload.</p>
    <p class="mt-2">Navigation within a page are considered part of the current session.</p>

    <p class="mt-2">Data can be downloaded in <a target="_blank" href="https://webrecorder.github.io/wacz-spec/">WACZ Format</a> at any time.</p>

    <p class="mt-2">The WACZ file is also signed with a key generated in the browser.</p>

    <p class="mt-2">When sharing to IPFS, data is stored in Filecoin using <a target="_blank" href="https://web3.storage/">web3.storage</a>
    and shared via IPFS.</p>

    <p class="mt-2">The <a target="_blank" href="https://github.com/webrecorder/express.archiveweb.page">system</a> and the <a href="https://github.com/webrecorder/wabac-cors-proxy">proxy</a> are fully open source.</p>

    <h3 class="mt-6">Support</h3>
    <p class="mt-2">If this tool is useful, considering support the Webrecorder:</p>
    <ul class="list-disc list-inside">
      <li>Via <a target="_blank" href="https://opencollective.com/webrecorder">OpenCollective</a></li>
      <li>Via <a target="_blank" href="https://github.com/sponsors/webrecorder">GitHub Sponsors</a></li>
    </ul>

    <h3 class="mt-6">Privacy Policy</h3>
    <p class="mt-2">
    All web content is sent through a Cloudflare Worker proxy. This tool is inteded for quickly
    archiving public data. Do not use it for anything that is sensitive.</p>

    <p class="mt-2">
    Other than the Cloudflare proxy, the archiving happens locally. However, data is also shared if using the 'Share via IPFS' option.</p>

    <p class="mt-2">Once the data is shared,
    it is uploaded to a web3.storage account associated with this tool (unless you provide a custom key). web3.storage then attempts to store the data long-term
    through Filecoin deals. Note that this data is not encrypted, and anyone maybe able to access the data given the IPFS CID. Pinning to IPFS and long-term storage is dependent on the functionality of the web3.storage service, from Protocol Labs.</p>

    <h4 class="mt-6">Disclaimer</h4>
    <p class="text-xs">DISCLAIMER OF SOFTWARE WARRANTY. WEBRECORDER SOFTWARE PROVIDES THIS SOFTWARE TO YOU "AS AVAILABLE"
    AND WITHOUT WARRANTY OF ANY KIND, EXPRESS, IMPLIED OR OTHERWISE,
    INCLUDING WITHOUT LIMITATION ANY WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.</p>

    <sl-button @click="${() => this.showAbout = false}" slot="footer" variant="primary">Close</sl-button>
    </sl-dialog>
    `;
  }

  renderPublicKey() {
    return html`
    <sl-dialog @sl-hide="${() => this.showPublicKey = false}" label="Public Key" ?open="${this.showPublicKey}">

    <p>ArchiveWeb.page Express uses a signing key to sign the WACZ files that it creates.</p>
    
    <p>The following public key is unique to your
    browser profile and can be used prove that you created each archive (WACZ file) that you download or share.</p>

    <sl-textarea resize="none" placeholder="No key yet. The key will be generated as soon as you download or share the first WACZ file" readonly="true" value="${this.publicKey}"></sl-textarea>
    <sl-button @click="${() => this.showPublicKey = false}" slot="footer" variant="primary">Close</sl-button>
    </sl-dialog>`;
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

customElements.define("live-web-proxy", LiveWebRecorder);

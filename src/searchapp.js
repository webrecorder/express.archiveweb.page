import LiveWebRecorder from ".";

export default class SearchApp extends LiveWebRecorder
{
  constructor() {
    this.searchMode = false;
    this.searchMatchType = "exact";
    this.searchRoot = window.localStorage.getItem("indexRoot") || null;

    this.index = null;
  }

  static get properties() {
    return {
      ...LiveWebRecorder.properties,

      searchMode: { type: String },
      searchResults: { type: Array },
      searchMatchType: { type: String },
      searchRoot: { type: String }
    }
  }

    // async updated(changedProps) {
    //   if (!this.searchMode) {
    //     return;
    //   }
      
    //   if (changedProps.has("url") || changedProps.has("searchMatchType") || changedProps.has("searchRoot")) {
    //     await this.doSearch();
    //   }
    // }

  handleHashChange(m) {
    if (m[2].startsWith("search?")) {
      this.searchMode = true;
      const params = new URLSearchParams(m[2].slice("search?".length));
      this.url = params.get("url");
      this.searchMatchType = params.get("matchType") || "exact";
      if (params.get("searchRoot")) {
        this.searchRoot = params.get("searchRoot");
      }
      this.doSearch();
    } else {

      this.searchMode = false;
      super.handleHashChange(m);
    }
  }

  initCollection() {
    if (!this.searchMode) {
      super.initCollection();
    }
  }

  async onUpload() {
    await this.onUpload();

    if (!this.index) {
      this.index = new URLIndexWrapper();
      this.searchRoot = await this.index.init(this.searchRoot);
    }

    const root = await this.index.add({url, ts, title, cid});
    if (root) {
      this.searchRoot = root;
    }

    window.localStorage.setItem("indexRoot", this.searchRoot);
  }

  renderContent() {
    return `
    <sl-tab-group @sl-tab-show="${this.onShowTab}">
    <sl-tab slot="nav" .active="${!this.searchMode}" panel="create">Create New</sl-tab>
    <sl-tab slot="nav" .active="${this.searchMode}" panel="search">Search Archives</sl-tab>

    <sl-tab-panel name="create" .active="${!this.searchMode}">
      ${this.renderArchiveView()}
    </sl-tab-panel>

    <sl-tab-panel name="search" .active="${this.searchMode}">
      <sl-form @sl-submit="${this.onUpdateSearch}" class="grid grid-cols-1 gap-3 mb-4">
        <div class="flex mb-4">
          <sl-input class="rounded w-full" id="searchRoot" placeholder="Enter Search Root" .value="${this.searchRoot}">
          </sl-input>
        </div>
        <div class="flex">
          ${this.loading ? html`
          <sl-button style="width: 48px" class="ml-1" type="default" loading="default"></sl-button>
          ` : html`
          <sl-button @click="${this.onUpdateSearch}" style="width: 48px" class="mr-1" type="default">
            <sl-icon class="text-2xl align-middle" name="arrow-clockwise"></sl-icon>
          </sl-button>`}

          <sl-select class="mr-1" id="matchType" value="${this.searchMatchType}" @sl-change="${this.onChangeMatchType}">
            <sl-menu-item value="exact">Exact</sl-menu-item>
            <sl-menu-item value="prefix">Prefix</sl-menu-item>
            <sl-menu-item value="raw-prefix">TLD</sl-menu-item>
          </sl-select>

          <sl-input class="rounded w-full" id="searchUrl" placeholder="Search by URL" .value="${this.url}">
          </sl-input>
        </div>
      </sl-form>

      <div class="flex flex-col">
        ${this.loading ? html`
        <span class="flex items-center ml-4 mt-4">
          <sl-spinner class="text-4xl mr-4"></sl-spinner>Loading, Please wait...
        </span>` : html`
        <div class="text-lg">${this.searchResults && this.searchResults.length} result(s)</div>

        ${this.searchResults && this.searchResults.map(result => html`
        <sl-details class="mb-2 search-result" @sl-show="${() => this.onShowResult(result, true)}" @sl-hide="${() => this.onShowResult(result, false)}">
          <div slot="summary" class="flex flex-col">
            <span><a target="_blank" href="https://dweb.link/ipfs/${result.cid}/#${toParams({url: result.url})}">${result.url} <sl-icon class="ml-1" name="box-arrow-up-right"></sl-icon></a></span>
            <span class="text-gray-400">${getKeyToDate(result.key)}</span>
          </div>
          ${result.show ? html`<replay-web-page source="https://dweb.link/ipfs/${result.cid}/webarchive.wacz" url="${result.url}"></replay-web-page>` : ""}
        </sl-details>
        `)}`}
      </div>
    </sl-tab-panel>

  </sl-tab-group>`;
  }

  onShowTab(event) {
    const name = event.detail.name;
    this.searchMode = (name === "search");
    if (this.searchMode) {
      this.doSearch();
    } else {
      this.initCollection();
    }
  }

  async onUpdateSearch() {
    const url = this.renderRoot.querySelector("#searchUrl").value;
    this.url = url;

    const root = this.renderRoot.querySelector("#searchRoot").value;
    if (root && root !== this.searchRoot) {
      this.searchRoot = root;
      await this.index.init(root);
    }

    await this.doSearch();
  }

  onChangeMatchType(event) {
    this.searchMatchType = event.currentTarget.value;

    this.doSearch();
  }

  async doSearch() {
    if (this.loading) {
      //return;
    }

    if (!this.url) {
      this.url = "https://example.com/";
    }

    this.loading = true;

    const params = new URLSearchParams();
    params.set("url", this.url);
    params.set("matchType", this.searchMatchType);
    if (this.searchRoot) {
      params.set("searchRoot", this.searchRoot);
    }

    window.location.hash = `#search?${params}`;

    this.searchResults = await this.getSearchResults({url: this.url, matchType: this.searchMatchType});

    this.loading = false;
  }

  async getSearchResults(params) {
    if (!this.index) {
      this.index = new URLIndexWrapper();
      await this.index.init(this.searchRoot);
    }

    return await this.index.query(params);
  }
}

function toParams(obj) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    params.set(k, v);
  }
  return params.toString();
}

function getKeyToDate(key) {
  return new Date(tsToDateMin(key.split(" ")[1])).toLocaleString();
}

customElements.define("wr-rec-search-app", SearchApp);
export class SimpleCrawler
{
  constructor(comp, iframe) {
    this.comp = comp;

    this.iframe = iframe;
    this.links = new Set();
    this.seen = new Set();

    this.iter = null;

    this.status = "not_started";
  }

  extractLinks(currentUrl, sel = "a[href]", sameDomainOnly = true) {
    const origin = new URL(currentUrl).origin;

    const elems = this.iframe.contentDocument.querySelectorAll(sel);

    for (const elem of elems) {
      elem._no_rewrite = true;
      let url = elem.href || elem.src;
      delete elem._no_rewrite;

      if (!url.startsWith("http:") && !url.startsWith("https:")) {
        continue;
      }

      try {
        url = new URL(url);
        url.hash = "";
        url = url.href;
      } catch (e) {
        console.warn("Skipping invalid: " + url);
        continue;
      }

      if (this.seen.has(url)) {
        continue;
      }

      if (sameDomainOnly) {
        const actualOrigin = new URL(elem.href || elem.src).origin;
        if (actualOrigin !== origin) {
          console.log("skipping other origin: " + actualOrigin);
          continue;
        }
      }

      this.links.add(url);
      this.seen.add(url);
    }
    this.updateState();
  }

  async* doIter() {
    const iframe = this.iframe;

    while (this.links.size) {
      const url = Array.from(this.links.values())[0];

      iframe.contentWindow.location.href = url;
      const p = new Promise((resolve) => {
        iframe.addEventListener("load", () => resolve());
      });

      await p;
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.links.delete(url);
      this.updateState();

      yield url;
    }
  }

  start(...args) {
    this.status = "running";
    this.extractLinks(...args);
    return this.run();
  }

  async run() {
    for await (const url of this.doIter()) {
      //console.log("loading: " + url);

      if (this.status !== "running") {
        break;
      }
    }

    if (this.status === "running") {
      this.status = "done";
      this.updateState();
    }
  }

  togglePause() {
    switch (this.status) {
      case "running":
        this.status = "paused";
        this.updateState();
        break;

      case "paused":
        this.status = "running";
        this.updateState();
        this.run();

      default:
        console.warn("togglePause while: " + this.status);
        break;
    }
  }

  updateState() {
    this.comp.crawlState = {
      status: this.status,
      count: this.count,
      total: this.total
    }
  }

  get total() {
    return this.seen.size;
  }

  get count() {
    return this.seen.size - this.links.size;
  }
}
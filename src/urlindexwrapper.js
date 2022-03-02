import { create as IPFSCreate } from "ipfs-core";
import { CarWriter } from "@ipld/car";

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
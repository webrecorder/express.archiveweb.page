# ArchiveWeb.page Express

ArchiveWeb.page Express offers high-fidelity web archiving directly in the browser!
It provides a more streamlined version of ArchiveWeb.page system without requiring a custom extension or desktop app!

AWP Express is designed for archiving public websites only.

It currently includes:
- Browser-based archiving of content loaded in the browser
- Option to download WACZ file
- Option to upload to IPFS/Filecoin via [web3.storage](https://web3.storage)
- With version 0.2.0, the system also includes an experimental simple crawl option for visiting all links on a page automatically.

## How it loads content

Browsers are generally not able to load any websites, so a proxy must be used.

The system uses [wabac-cors-proxy](https://github.com/webrecorder/wabac-cors-proxy) to proxy data from the live
web via a Cloudflare Worker. This allows the system to load any website without browser 'cross-origin' restrictions.

However, this only works with sites that are loadable through Cloudflare.

All network traffic goes through the Cloudflare Worker, so this is not ideal for archiving non-public content.

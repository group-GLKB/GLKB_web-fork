# GLKB_web

## New Graph Viewer

Open `/graph-viewer` (also linked from `/search`). The request contract follows
`Ocelot-29A/gkb2_frontend`, branch `xuteng/react`, `GraphViewerQueryDialog.js`.
Set `REACT_APP_GRAPH_VIEWER_API_URL` at build time to override the default
`https://jieliulab3.dcmb.med.umich.edu/gkb0708/api/graph` endpoint.
This is independent of `REACT_APP_API_PROXY_TARGET`; the graph backend must allow
browser CORS from the deployed frontend origin and localhost for development.
GLKB auth interceptors are not attached to this separate HTTP client.

The viewer posts JSON with `cypher`, `core_nodes`, `max_nodes`, and
`layout_mode: "kg_only"`, accepts `combined_query_result`/`graph` and
`xy_json`/`coords`, and uses server node coordinates when complete (otherwise
local fcose layout). Genome tracks and backend edge routing are not rendered.
Queries only run on explicit submission and can be cancelled. Old entity search,
node-detail APIs and saved graphs remain on the legacy backend; they do not have
equivalent endpoints in the reference viewer contract.

Backend source was verified against `RingoMao/Graph_viewer`, branch `GKB`,
commit `449756bc58916ff54d3d397632e78c74ace60d7c` via Git SSH. Node types follow
the backend's canonical type priority (not Neo4j label order). Server rectangles
supply node centers, width, height and Core/Neighbor styling. The backend caps
the real-node budget at 15; overflow display markers may increase the displayed
node count. Their descriptions remain available in node properties.

## Link to the homepage

https://glkb.org/

## NavBar Connecting to Backend API (branch 5)
The latest version is pushed at the branch yijia/5/revise-nav-bar.

(Only adding the /NavBar component)

All the input contents will be stored in the array tags. 

Revise the NavBar\index.jsx line 41 - 47 to handle the search (api) and add some states (?)

Handle search is called at line 83 and line 26 

(corresponding to situation 1: click on search button and situation2: keyboard enter with no current input)

```js
    const handleSearch = () => {
        // Perform search using the tags array
        console.log('Searching for:', tags);
        // Implement the search logic here
        // Clear the tags if needed after search
        setTags([]);
    };
```

## Set the information header to the node detail name (branch 4)
The latest version is pushed at the branch yijia/4/revise-right-form-header

- Fix the problem of only showing the sample data for edge details
- Revise the name for the form header

Only revise the file src/components/Information/index.jsx

##NOTE!!: Suggest merging branch 4 to master first and then 5


## 2024-1-29 Note:
Branch 5 update with styling search bar and search bar logic

## 2024-2-12
Branch 7 Revise the styling of the title of the information form on the right

The title is extracted on the top. Stick to the top is half implemented where
when the list is super long the title will scroll away.

Branch 7 also revise the api for retrieving info, please revise back to the original
one that should be used for deployment(when merging to the master branch)



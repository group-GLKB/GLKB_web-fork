import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import fcose from 'cytoscape-fcose';
import expandCollapse from 'cytoscape-expand-collapse';
import './scoped.css'
import { createExpandCollapseConfig } from './cytoscapeConfig';
import { trackEvent } from '../Units/analytics';

// Register the plugin if not already registered
if (typeof Cytoscape("core", "expandCollapse") === "undefined") {
    expandCollapse(Cytoscape);
}

Cytoscape.use(fcose);
Cytoscape.use(cola);

// Wrap the entire Graph component with React.memo
const Graph = React.memo(function Graph(props) {
  const [width, setWith] = useState('100%');
  const [height, setHeight] = useState('80vh');

  useEffect(() => {
    if (!props.data || !props.data.nodes) return;

    let curMinGtdcFreq = Number.MAX_SAFE_INTEGER;
    let curMaxGtdcFreq = Number.MIN_SAFE_INTEGER;
    let curMinGtdcNoc = Number.MAX_SAFE_INTEGER;
    let curMaxGtdcNoc = Number.MIN_SAFE_INTEGER;

    for (let i of props.data.nodes) {
      curMinGtdcFreq = Math.min(curMinGtdcFreq, i.data.frequency);
      curMaxGtdcFreq = Math.max(curMaxGtdcFreq, i.data.frequency);
      curMinGtdcNoc = Math.min(curMinGtdcNoc, i.data.n_citation);
      curMaxGtdcNoc = Math.max(curMaxGtdcNoc, i.data.n_citation);
    }
    props.handleMinGtdcFreq(curMinGtdcFreq);
    props.handleMaxGtdcFreq(curMaxGtdcFreq);
    props.handleGtdcFreq([curMinGtdcFreq, curMaxGtdcFreq]);
    props.handleMinGtdcNoc(curMinGtdcNoc);
    props.handleMaxGtdcNoc(curMaxGtdcNoc);
    props.handleGtdcNoc([curMinGtdcNoc, curMaxGtdcNoc]);
  }, [props.data]);

  const layout = {
    name: 'fcose',
    fit: true,
    padding: 50,
    idealEdgeLength: 150,
    nodeRepulsion: 8000,
    edgeElasticity: 0.45,
    tile: true,
    tilingPaddingVertical: 10,
    tilingPaddingHorizontal: 10,
    quality: "default",
    animate: true,
    animationDuration: 1000,
    randomize: true,
    gravity: 0.25,
    gravityRangeCompound: 1.5,
    gravityCompound: 1.0,
    alignmentConstraint: { vertical: [], horizontal: [] },
    relativePlacementConstraint: [],
    numIter: 2500,
    nodeSeparation: 75
  };

  const styleSheet = [
    {
      selector: 'node',
      style: {
        'transition-property': 'width, height, border-width, border-color, background-color',
        'transition-duration': '0.2s',
        'label': 'data(name)',
        'text-valign': 'center',
        'text-halign': 'right',
        'text-margin-x': 8,
        'color': '#333333',
        'font-size': '11px',
        'text-max-width': '150px',
        'text-wrap': 'ellipsis',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
      }
    },
    {
      selector: 'node.hover',
      style: {
        'border-width': '4px', // Reduced from 6px
        'border-color': '#AAD8FF',
        'border-opacity': '0.5',
        'background-color': '#77828C',
        'transition-property': 'border-width, border-color, background-color',
        'transition-duration': '0.15s',
        'z-index': 999
      }
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'width': 2,
        'transition-property': 'opacity, line-color, width',
        'transition-duration': '0.2s'
      }
    },
    {
      selector: "node[type='device']",
      style: {
        shape: 'rectangle',
      },
    },
    {
      selector: 'edge[label="Contain_term"]',
      style: {
        'width': 3,
        'opacity': 'mapData(weight, 1, 100, 0.5, 1)',
        'line-color': '#D3D3D3'  // Light grey
      }
    },
    {
      selector: 'edge[label="co_occur"]',
      style: {
        "curve-style": "haystack",
        'width': 3,
        'opacity': 'mapData(weight, 1, 100, 0.4, 1)',
        'line-color': '#D3D3D3',  // Light grey
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Semantic_relationship"]',
      style: {
        "curve-style": "haystack",
        width: 3,
        'opacity': 'mapData(weight, 1, 100, 0.4, 1)',
        'line-color': '#D3D3D3',  // Light grey
        'line-style': 'solid',
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Hierarchical_structure"]',
      style: {
        "curve-style": "haystack",
        width: 3,
        'opacity': 'mapData(weight, 1, 100, 0.4, 1)',
        'line-color': '#D3D3D3',  // Light grey
        'line-style': 'dotted',
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Curated_relationship"]',
      style: {
        "curve-style": "haystack",
        'width': 3,
        'opacity': 'mapData(weight, 1, 100, 0.4, 1)',
        'line-color': '#D3D3D3',  // Light grey
        'line-style': 'dashed',
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'node.highlight',
      style: {
        'border-color': '#FFF',
        'border-width': '1px'
      }
    },
    {
      selector: 'node.semitransp',
      style: { 'opacity': '0.2' }
    },
    {
      selector: 'edge.highlight',
      style: { 'mid-target-arrow-color': '#FFF' }
    },
    {
      selector: 'edge.semitransp',
      style: { 'opacity': '0.2' }
    },
    {
      selector: '$node > node',
      style: {
        'padding-top': '10px',
        'padding-left': '10px',
        'padding-bottom': '10px',
        'padding-right': '10px',
        'background-color': '#f0f0f0',
        'background-opacity': 0.15,
        'border-color': '#d3d3d3',
        'border-width': '1px'
      }
    },
    {
      selector: 'node:childless',
      style: {
        'shape': 'roundrectangle',
        'border-radius': '4px',
        'width': 'label',
        'height': '25px',
        'padding': '10px',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-margin-x': 0,
        'color': '#ffffff',
        'font-size': '11px',
        'text-wrap': 'ellipsis',
        'text-max-width': '120px',
        'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
      }
    },
    {
      selector: 'node.group-node',
      style: {
        'background-color': '#e6e6e6',
        'background-opacity': 0.25,
        'shape': 'roundrectangle',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-margin-x': 0,
        'text-margin-y': 0,
        'font-weight': 'bold',
        'font-size': '16px',
        'color': '#555555',
        'text-opacity': 0.8,
        'padding': '25px',
        'border-width': '1px',
        'border-color': '#d3d3d3',
        'border-opacity': 0.8,
        'text-wrap': 'none',
        'width': 'label',
        'height': '35px',
        'compound-sizing-wrt-labels': 'include'
      }
    }
  ];

  const graphData = useMemo(() => {
    if (!props.data || !props.data.nodes || !props.data.edges) {
      return { edges: [], nodes: [] };
    }

    let elements = { edges: [], nodes: [] };

    // Process nodes and create group nodes if needed
    props.data.nodes.forEach(node => {
      // Add the regular node
      elements.nodes.push({
        data: {
          ...node.data,
          id: node.data.id,
          parent: node.data.parent // Include parent reference if it exists
        }
      });

      // If this node has a group but the group node doesn't exist yet, create it
      if (node.data.parent && !elements.nodes.find(n => n.data.id === node.data.parent)) {
        elements.nodes.push({
          data: {
            id: node.data.parent,
            display: node.data.group, // Use group name as display label
            isGroup: true
          },
          classes: 'group-node'
        });
      }
    });

    // Process edges
    if (props.data.edges) {
      elements.edges = props.data.edges.map(edge => ({
        data: {
          ...edge.data,
          id: edge.data.eid ? edge.data.eid[0] : `${edge.data.source}-${edge.data.target}`,
          source: edge.data.source,
          target: edge.data.target,
          weight: edge.data.weight || 1
        }
      }));
    }

    return elements;
  }, [props.data]);

  // Add early return if no data
  if (!props.data || !props.data.nodes) {
    return <div>Loading...</div>;
  }

  let id = []
  for (var i in graphData.nodes) {
    id.push([
      graphData.nodes[i].data.id,
      graphData.nodes[i].data.display,
      graphData.nodes[i].data.frequency,
      graphData.nodes[i].data.n_citation,
      graphData.nodes[i].data.key_nodes,
      graphData.nodes[i].data.label  // Add this line to include the label
    ])
  }
  console.log(graphData)

  for (var i in id) {
    let labelColor = ''
    let size = ''
    let shape = ''
    let borderWidth = ''
    let borderColor = ''
    switch (id[i][5]) {  // Change this to use index 5 (label) instead of 1 (name)
      case 'AnatomicalEntity':
        labelColor = '#374B73'  // Navy blue
        break;
      case 'ChemicalEntity':
        labelColor = '#94B0DA'  // Light blue
        break;
      case 'DiseaseOrPhenotypicFeature':
        labelColor = '#E3E8F0'  // Pale blue
        break;
      case 'Gene':
        labelColor = '#E07A5F'  // Coral/salmon
        break;
      case 'BiologicalProcessOrActivity':
        labelColor = '#3D405B'  // Dark slate
        break;
      case 'MeshTerm':
        labelColor = '#81B29A'  // Sage green
        break;
      case 'SequenceVariant':
        labelColor = '#F2CC8F'  // Warm sand
        break;
      case 'Article':
        labelColor = '#C4C4C4'  // Light grey for articles
        break;
    }
    if (id[i][2] >= 60) {
      size = 40
    } else if (id[i][2] < 60 && id[i][2] >= 30) {
      size = 30
    } else {
      size = 20
    }
    if (id[i][4] == "true") {
      borderWidth = '1px'
      borderColor = 'red'
    } else {
      shape = 'ellipse'
    }
    // console.log(index)
    styleSheet.push({
      selector: 'node[id = "' + id[i][0] + '"]:childless',
      style: {
        backgroundColor: labelColor,
        backgroundOpacity: 0.9,
        shape: 'roundrectangle',
        borderRadius: '4px',
        borderWidth: borderWidth ? borderWidth : 0,
        borderColor: borderColor ? borderColor : 'transparent',
        'min-width': size,
        'min-height': Math.max(25, size * 0.5),
        label: id[i][1],
        'text-valign': 'center',
        'text-halign': 'center',
        'color': '#000000',
        'font-size': '11px',
        'text-wrap': 'ellipsis',
        'text-max-width': '120px',
        width: 'label',
        height: '25px',
        padding: '10px'
      },
    })
  }
  // console.log(styleSheet)

  const myCyRef = useRef(null);

  useEffect(() => {
    if (myCyRef.current) {
      myCyRef.current.fit();
      myCyRef.current.center();
    }
  }, [graphData]);

  // Memoize the click handlers
  const handleNodeClick = useCallback((node) => {
    if (!node.hasClass('group-node')) {
      // Extract only the necessary data from the node
      const nodeData = {
        id: node.data('id'),
        name: node.data('name'),
        label: node.data('label'),
        database_id: node.data('database_id'),
        frequency: node.data('frequency'),
        n_citation: node.data('n_citation'),
        key_nodes: node.data('key_nodes'),
        parent: node.data('parent'),
        display: node.data('display')
      };
      
      props.handleSelect(nodeData);
      if (!props.informationOpen) {
        props.expandInformation();
      }
    }
  }, [props.handleSelect, props.informationOpen, props.expandInformation]);

  const handleEdgeClick = useCallback((edge) => {
    // Extract only the necessary data from the edge
    const edgeData = {
      id: edge.data('id'),
      source: edge.data('source'),
      target: edge.data('target'),
      label: edge.data('label'),
      weight: edge.data('weight'),
      eid: edge.data('eid'),
      article_source: edge.data('article_source')
    };
    
    props.handleSelect(edgeData);
    if (!props.informationOpen) {
      props.expandInformation();
    }
  }, [props.handleSelect, props.informationOpen, props.expandInformation]);

  // Memoize the Cytoscape initialization callback
  const cyInitCallback = useCallback((cy) => {
    myCyRef.current = cy;

    // Initialize expand-collapse API
    const api = cy.expandCollapse(createExpandCollapseConfig());

    // Add collapse/expand event handlers without tracking
    cy.on('expandcollapse.beforecollapse', 'node', function(event) {
        const node = event.target;
    });

    cy.on('expandcollapse.afterexpand', 'node', function(event) {
        const node = event.target;
    });

    // Double click to expand/collapse
    cy.on('dblclick', 'node', function(event) {
        const node = event.target;
        if (node.isParent()) {
            if (node.hasClass('cy-expand-collapse-collapsed-node')) {
                api.expand(node);
            } else {
                api.collapse(node);
            }
        }
    });

    cy.unbind("click");
    cy.on('click', function (e) {
      var sel = e.target;
      if (sel.isNode && !sel.hasClass('group-node')) {
        sel.visibility = 'hidden'
        cy.elements().removeClass('semitransp');
        cy.elements().removeClass('highlight');
        cy.elements().difference(sel.outgoers().union(sel.incomers())).not(sel).addClass('semitransp');
        sel.addClass('highlight').outgoers().union(sel.incomers()).addClass('highlight');
      }
      if (sel === cy) {
        cy.elements().removeClass('semitransp');
        cy.elements().removeClass('highlight');
        if (props.informationOpen) {
          props.handleInformation();
        }
      }
    });

    cy.on('mouseover', 'node', function (e) {
      var sel = e.target;
      sel.addClass('hover');
    });

    cy.on('mouseout', 'node', function (e) {
      var sel = e.target;
      sel.removeClass('hover');
    });

    cy.bind('click', 'node', (evt) => handleNodeClick(evt.target));
    cy.bind('click', 'edge', (evt) => handleEdgeClick(evt.target));
  }, [handleNodeClick, handleEdgeClick, props.handleInformation, props.informationOpen]);

  return (
    <div>
      <div>
        <CytoscapeComponent
          elements={CytoscapeComponent.normalizeElements(graphData)}
          style={{ width: width, height: height }}
          zoomingEnabled={true}
          maxZoom={2}
          minZoom={0.1}
          autounselectify={false}
          boxSelectionEnabled={true}
          layout={layout}
          stylesheet={styleSheet}
          cy={cyInitCallback}
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.data === nextProps.data &&
    prevProps.gtdcFreq[0] === nextProps.gtdcFreq[0] &&
    prevProps.gtdcFreq[1] === nextProps.gtdcFreq[1] &&
    prevProps.gtdcNoc[0] === nextProps.gtdcNoc[0] &&
    prevProps.gtdcNoc[1] === nextProps.gtdcNoc[1]
  );
});

export default Graph;
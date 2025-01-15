import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import fcose from 'cytoscape-fcose';
import './scoped.css'

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
        'line-color': 'rgba(255, 127, 80, 0.8)'
      }
    },
    {
      selector: 'edge[label="co_occur"]',
      style: {
        "curve-style": "haystack",
        'width': 3,
        'opacity': 'mapData(weight, 1, 100, 0.4, 1)',
        'line-color': '#008080',  // Teal
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Semantic_relationship"]',
      style: {
        "curve-style": "haystack",
        width: 3,
        'opacity': 'mapData(weight, 1, 100, 0.4, 1)',
        'line-color': '#4682B4',  // Steel Blue
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
        'line-color': '#E0B0FF',  // Mauve
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
        'line-color': '#32CD32',  // Lime Green
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
        style:{ 'opacity': '0.2' }
    },
    {
        selector: 'edge.highlight',
        style: { 'mid-target-arrow-color': '#FFF' }
    },
    {
        selector: 'edge.semitransp',
        style:{ 'opacity': '0.2' }
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
    
    // Count nodes in each group first
    const groupCounts = {};
    props.data.nodes.forEach(node => {
      if (node.data.group) {
        groupCounts[node.data.group] = (groupCounts[node.data.group] || 0) + 1;
      }
    });

    // Only create group nodes for groups with multiple nodes
    Object.entries(groupCounts).forEach(([group, count]) => {
      if (count > 1) {  // Only create group if it has more than one node
        elements.nodes.push({
          data: {
            id: `group-${group}`,
            label: group,
            name: group
          },
          classes: ['group-node']
        });
      }
    });

    // Add regular nodes with parent references (only if group has multiple nodes)
    for (let i in props.data.nodes) {
      let node = props.data.nodes[i].data;
      if (node.frequency >= props.gtdcFreq[0] && 
          node.frequency <= props.gtdcFreq[1] && 
          node.n_citation >= props.gtdcNoc[0] && 
          node.n_citation <= props.gtdcNoc[1]) {
        elements.nodes.push({
          ...props.data.nodes[i],
          data: {
            ...props.data.nodes[i].data,
            parent: node.group && groupCounts[node.group] > 1 ? `group-${node.group}` : undefined
          }
        });
      }
    }

    // Add edges (unchanged)
    for (let i in props.data.edges) {
      let edge = props.data.edges[i].data;
      if (elements.nodes.find((node) => node.data.id === edge.source) != undefined &&
          elements.nodes.find((node) => node.data.id === edge.target) != undefined) {
        elements.edges.push(props.data.edges[i]);
      }
    }

    return elements;
  }, [props.data, props.gtdcFreq, props.gtdcNoc]);

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
    switch(id[i][5]) {  // Change this to use index 5 (label) instead of 1 (name)
      case 'AnatomicalEntity':
        labelColor = '#E43333'
      break;
      case 'ChemicalEntity':
        labelColor = '#E8882F'
      break;
      case 'DiseaseOrPhenotypicFeature':
        labelColor = '#67BE48'
      break;
      case 'Gene':
        labelColor = '#46ACAC'
      break;
      case 'BiologicalProcessOrActivity':
        labelColor = '#5782C2'
      break;
      case 'MeshTerm':
        labelColor = '#9B58C5'
      break;
      case 'SequenceVariant':
        labelColor = '#D829B1'
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
        'color': '#ffffff',
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
      props.handleSelect(node.data());
      if (!props.informationOpen) {
        props.expandInformation();
      }
    }
  }, [props.handleSelect, props.informationOpen, props.expandInformation]);

  const handleEdgeClick = useCallback((edge) => {
    props.handleSelect(edge.data());
    if (!props.informationOpen) {
      props.expandInformation();
    }
  }, [props.handleSelect, props.informationOpen, props.expandInformation]);

  // Memoize the Cytoscape initialization callback
  const cyInitCallback = useCallback((cy) => {
    myCyRef.current = cy;

    cy.unbind("click");
    cy.on('click', function(e){
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

    cy.on('mouseover', 'node', function(e){
      var sel = e.target;
      sel.addClass('hover');
    });
    
    cy.on('mouseout', 'node', function(e){
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
          key={JSON.stringify(graphData)}
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

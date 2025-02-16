import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import fcose from 'cytoscape-fcose';
import './scoped.css'

Cytoscape.use(fcose);
Cytoscape.use(cola);

// Wrap the entire Graph component with React.memo and add a custom comparison function
const Graph = React.memo(function Graph(props) {
  const [width, setWith] = useState('100%');
  const [height, setHeight] = useState('80vh');
  const myCyRef = useRef(null);

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
    padding: 30,
    idealEdgeLength: 100,
    nodeRepulsion: 4500,
    edgeElasticity: 0.45,
    tile: true,
    tilingPaddingVertical: 5,
    tilingPaddingHorizontal: 5,
    quality: "default",
    animate: true,
    animationDuration: 500,
    randomize: false,
    gravity: 0.5,
    gravityRangeCompound: 1.5,
    gravityCompound: 1.0,
    alignmentConstraint: { vertical: [], horizontal: [] },
    relativePlacementConstraint: [],
    numIter: 2000,
    nodeSeparation: 30
  };

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

  // Memoize the graph data processing
  const graphData = useMemo(() => {
    if (!props.data || !props.data.nodes || !props.data.edges) {
      return { edges: [], nodes: [] };
    }

    let elements = { edges: [], nodes: [] };

    // Add all nodes that pass the frequency and citation filters
    for (let node of props.data.nodes) {
      // Skip nodes that don't meet the filter criteria
      if (!node.data.is_group && (
          node.data.frequency < props.gtdcFreq[0] || 
          node.data.frequency > props.gtdcFreq[1] || 
          node.data.n_citation < props.gtdcNoc[0] || 
          node.data.n_citation > props.gtdcNoc[1])) {
        continue;
      }

      // Add the node with its existing parent reference
      elements.nodes.push(node);
    }

    // Add edges only between nodes that exist in our filtered set AND are not in the same group
    // AND don't connect to group nodes
    for (let edge of props.data.edges) {
      const sourceNode = elements.nodes.find(node => node.data.id === edge.data.source);
      const targetNode = elements.nodes.find(node => node.data.id === edge.data.target);
      
      if (sourceNode && targetNode) {
        // Skip edges between nodes in the same group or if either node is a group node
        if (sourceNode.data.parent === targetNode.data.parent ||
            sourceNode.data.is_group || targetNode.data.is_group) {
          continue;
        }
        elements.edges.push(edge);
      }
    }

    return elements;
  }, [props.data, props.gtdcFreq, props.gtdcNoc]);

  // Memoize the stylesheet
  const styleSheet = useMemo(() => {
    const styles = [
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

    if (graphData.nodes) {
      let id = graphData.nodes.map(node => [
        node.data.id,
        node.data.display,
        node.data.frequency,
        node.data.n_citation,
        node.data.key_nodes,
        node.data.label
      ]);

      for (var i in id) {
        let labelColor = ''
        let size = ''
        let borderWidth = ''
        let borderColor = ''

        // Skip style generation for group nodes
        if (id[i][5] === 'Unknown') continue;

        switch(id[i][5]) {
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
        }

        styles.push({
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
        });
      }
    }

    // Add specific style for group nodes
    styles.push({
      selector: 'node[?is_group]',
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
    });

    return styles;
  }, [graphData]);

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

  // Add early return if no data
  if (!props.data || !props.data.nodes) {
    return <div>Loading...</div>;
  }

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
          userZoomingEnabled={true}
          userPanningEnabled={true}
          autoungrabify={false}
          fit={true}
          pan={{ x: 0, y: 0 }}
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
    prevProps.gtdcNoc[1] === nextProps.gtdcNoc[1] &&
    prevProps.informationOpen === nextProps.informationOpen &&
    prevProps.selectedID === nextProps.selectedID
  );
});

export default Graph;

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import fcose from 'cytoscape-fcose';
import './scoped.css'

Cytoscape.use(fcose);
Cytoscape.use(cola);

// Add this before the Graph component definition
const arePropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.data === nextProps.data &&
    prevProps.gtdcFreq[0] === nextProps.gtdcFreq[0] &&
    prevProps.gtdcFreq[1] === nextProps.gtdcFreq[1] &&
    prevProps.gtdcNoc[0] === nextProps.gtdcNoc[0] &&
    prevProps.gtdcNoc[1] === nextProps.gtdcNoc[1] &&
    prevProps.informationOpen === nextProps.informationOpen
  );
};

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

  // Memoize the layout configuration
  const layout = useMemo(() => ({
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
  }), []); // Empty dependency array since this is static

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

  // Memoize the stylesheet generation
  const generateStyleSheet = useCallback((id) => {
    const baseStyleSheet = [
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
          'compound-sizing-wrt-labels': 'include',
          'label': 'data(display)'
        }
      }
    ];

    const nodeStyles = id.map(nodeId => {
      let labelColor = '';
      switch(nodeId[5]) {
        case 'AnatomicalEntity': labelColor = '#374B73'; break;
        case 'ChemicalEntity': labelColor = '#94B0DA'; break;
        case 'DiseaseOrPhenotypicFeature': labelColor = '#E3E8F0'; break;
        case 'Gene': labelColor = '#E07A5F'; break;
        case 'BiologicalProcessOrActivity': labelColor = '#3D405B'; break;
        case 'MeshTerm': labelColor = '#81B29A'; break;
        case 'SequenceVariant': labelColor = '#F2CC8F'; break;
        case 'Article': labelColor = '#C4C4C4'; break;
      }

      const size = nodeId[2] >= 60 ? 40 : nodeId[2] >= 30 ? 30 : 20;
      const borderWidth = nodeId[4] === "true" ? '1px' : 0;
      const borderColor = nodeId[4] === "true" ? 'red' : 'transparent';

      return {
        selector: `node[id = "${nodeId[0]}"]:childless`,
        style: {
          backgroundColor: labelColor,
          backgroundOpacity: 0.9,
          shape: 'roundrectangle',
          borderRadius: '4px',
          borderWidth,
          borderColor,
          'min-width': size,
          'min-height': Math.max(25, size * 0.5),
          label: nodeId[1],
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
      };
    });

    return [...baseStyleSheet, ...nodeStyles];
  }, []); // Empty dependency array since this is a pure function

  // Memoize the node IDs array
  const nodeIds = useMemo(() => {
    if (!graphData?.nodes) return [];
    return graphData.nodes.map(node => [
      node.data.id,
      node.data.display,
      node.data.frequency,
      node.data.n_citation,
      node.data.key_nodes,
      node.data.label
    ]);
  }, [graphData]);

  // Memoize the stylesheet
  const styleSheet = useMemo(() => 
    generateStyleSheet(nodeIds),
    [nodeIds, generateStyleSheet]
  );

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

  // Optimize cyInitCallback dependencies
  const cyInitCallback = useCallback((cy) => {
    myCyRef.current = cy;

    const handleClick = (e) => {
      const sel = e.target;
      if (sel.isNode && !sel.hasClass('group-node')) {
        cy.elements().removeClass('semitransp highlight');
        cy.elements()
          .difference(sel.outgoers().union(sel.incomers()))
          .not(sel)
          .addClass('semitransp');
        sel.addClass('highlight')
          .outgoers()
          .union(sel.incomers())
          .addClass('highlight');
      } else if (sel === cy) {
        cy.elements().removeClass('semitransp highlight');
        props.informationOpen && props.handleInformation();
      }
    };

    cy.on('click', handleClick);
    cy.on('mouseover', 'node', e => e.target.addClass('hover'));
    cy.on('mouseout', 'node', e => e.target.removeClass('hover'));
    cy.on('click', 'node', e => handleNodeClick(e.target));
    cy.on('click', 'edge', e => handleEdgeClick(e.target));

    return () => {
      cy.removeListener('click');
      cy.removeListener('mouseover');
      cy.removeListener('mouseout');
    };
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
}, arePropsEqual);

export default Graph;
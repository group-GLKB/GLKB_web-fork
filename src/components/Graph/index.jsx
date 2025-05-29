import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import fcose from 'cytoscape-fcose';
import './scoped.css'
import { debounce } from 'lodash';

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
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('calc(max(240px,(100vh - 134px)*0.4))');

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

    // Process nodes - simplified without group handling
    props.data.nodes.forEach(node => {
      elements.nodes.push({
        data: {
          ...node.data,
          id: node.data.id
        }
      });
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
          'transition-property': 'width, height, border-width, background-color',
          'border-opacity': 0.5,
          'border-width': '0px',
          'border-color': '#AAD8FF',
          'transition-duration': '0.2s',
          'label': 'data(name)',
          'text-valign': 'center',
          'text-halign': 'right',
          'text-margin-x': 8,
          'color': '#333333',
          'font-size': '11px',
          'text-max-width': '150px',
          'text-wrap': 'ellipsis',
          'font-family': 'Inter',
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
          'font-family': 'Inter',
        }
      },
    ];

    const additionalStyleSheet = [
      {
        selector: 'node.hover',
        style: {
          'border-width': '5px', // Reduced from 6px
          'border-opacity': '0.5',
          'transition-property': 'border-width',
          'transition-duration': '0.15s',
          'z-index': 999
        }
      },
      {
        selector: 'node.highlight',
        style: {
          'border-width': '10px',
          'border-opacity': '0.5',
          'transition-property': 'border-width',
          'transition-duration': '0.15s',
          'z-index': 99
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
    ];

    const nodeStyles = id.map(nodeId => {
      let labelColor = '';
      switch (nodeId[5]) {
        case 'AnatomicalEntity': labelColor = '#88E9C0'; break;
        case 'ChemicalEntity': labelColor = '#FFC0C0'; break;
        case 'DiseaseOrPhenotypicFeature': labelColor = '#F6C858'; break; //changed
        case 'Gene': labelColor = '#ADCFF2'; break; //changed
        case 'BiologicalProcessOrActivity': labelColor = '#EDC0FF'; break;
        case 'MeshTerm': labelColor = '#FFB77D'; break; //changed
        case 'SequenceVariant': labelColor = '#DBF4B1'; break;
        case 'Article': labelColor = '#E5E5E5'; break; //
      }

      const size = nodeId[2] >= 60 ? 40 : nodeId[2] >= 30 ? 30 : 20;
      // const borderWidth = nodeId[4] === "true" ? '1px' : 0;
      // const borderColor = nodeId[4] === "true" ? 'red' : 'transparent';

      return {
        selector: `node[id = "${nodeId[0]}"]`,
        style: {
          backgroundColor: labelColor,
          backgroundOpacity: 0.9,
          shape: 'roundrectangle',
          'corner-radius': '40',
          // borderWidth,
          // borderColor,
          'min-width': '130px',
          'min-height': Math.max(25, size * 0.5),
          label: nodeId[1],
          'text-halign': 'center',
          'text-valign': 'center',
          'text-margin-x': 0,
          'color': '#000000',
          'font-size': '20px',
          'text-wrap': 'wrap',
          'width': 'label',
          'padding': '10px',
          'text-wrap': 'wrap',
          'text-max-width': '10px',
          height: '35px',
        },
      };
    });

    return [...baseStyleSheet, ...nodeStyles, ...additionalStyleSheet];
  }, []);

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
    props.handleSelect(node.data());
    if (!props.informationOpen) {
      props.expandInformation();
    }
  }, [props.handleSelect, props.informationOpen, props.expandInformation]);

  // Add debouncing to prevent multiple rapid clicks
  const handleEdgeClick = useCallback(debounce((edge) => {
    props.handleSelect(edge.data());
    if (!props.informationOpen) {
      props.expandInformation();
    }
  }, 300), [props.handleSelect, props.informationOpen, props.expandInformation]);

  // Modify the cyInitCallback to use the debounced handler
  const cyInitCallback = useCallback((cy) => {
    myCyRef.current = cy;

    const handleClick = (e) => {
      const sel = e.target;

      // Check if the selection is a Cytoscape element
      if (sel && sel.isNode) {
        if (sel.isNode() && !sel.hasClass('group-node')) {
          // cy.elements().removeClass('semitransp highlight');
          // cy.elements()
          //   .difference(sel.outgoers().union(sel.incomers()))
          //   .not(sel)
          //   .addClass('semitransp');
          // sel.addClass('highlight')
          //   .outgoers()
          //   .union(sel.incomers())
          //   .addClass('highlight');
          cy.elements().removeClass('highlight');
          sel.addClass('highlight');
        }
      } else if (sel === cy) {
        // Clicked on empty canvas
        cy.elements().removeClass('highlight');
        props.informationOpen && props.handleInformation();
      }
    };

    // Remove any existing listeners first
    cy.removeAllListeners();

    cy.on('click', handleClick);
    cy.on('mouseover', 'node', e => e.target.addClass('hover'));
    cy.on('mouseout', 'node', e => e.target.removeClass('hover'));
    cy.on('click', 'node', e => handleNodeClick(e.target));
    cy.on('click', 'edge', e => handleEdgeClick(e.target));

    return () => {
      cy.removeAllListeners();
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
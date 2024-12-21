import React, { useState, useEffect, useMemo, useRef } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import fcose from 'cytoscape-fcose';
import './scoped.css'

Cytoscape.use(fcose);
Cytoscape.use(cola);

function Graph(props) {
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
    name: 'cola',
    egdeLengthVal: 200,
    nodeSpacing: 25,
    bundleEdges: true,
    animate: false,
    animationDuration: 1,
    maxSimulationTime: 1500,
    padding: 50,
    randomize: false,
    avoidOverlap: true,
    handleDisconnected: true,
    flow: { axis: 'y', minSeparation: 100 },
    alignmentConstraint: { axis: 'y', offsets: [] },
    relativePlacementConstraint: { axis: 'x', offsets: [] }
  };

  const styleSheet = [
    {
      selector: 'node.hover',
      style: {
        'border-width': '6px',
        'border-color': '#AAD8FF',
        'border-opacity': '0.3',
        'background-color': '#77828C',
        width: 'mapData(width, 20, 40, 30, 50)',
        height: 'mapData(height, 20, 40, 30, 50)',
        //text props
        'text-outline-color': '#77828C',
        'text-outline-width': 8,
      },
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
        "curve-style": "haystack",
        'width': 1,
        'opacity': 'mapData(weight, 1, 100, 0.3, 1)',
        'line-color': '#FF7F50',  // Coral
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="co_occur"]',
      style: {
        "curve-style": "haystack",
        'width': 1,
        'opacity': 'mapData(weight, 1, 100, 0.3, 1)',
        'line-color': '#008080',  // Teal
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Semantic_relationship"]',
      style: {
        "curve-style": "haystack",
        width: 1,
        'opacity': 'mapData(weight, 1, 100, 0.3, 1)',
        'line-color': '#4682B4',  // Steel Blue
        'line-style': 'solid',
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Hierarchical_structure"]',
      style: {
        "curve-style": "haystack",
        width: 1,
        'opacity': 'mapData(weight, 1, 100, 0.3, 1)',
        'line-color': '#E0B0FF',  // Mauve
        'line-style': 'dotted',
        'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Curated_relationship"]',
      style: {
        "curve-style": "haystack",
        'width': 1,
        'opacity': 'mapData(weight, 1, 100, 0.3, 1)',
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
      selector: 'node',
      style: {
        'transition-property': 'width, height, border-width, border-color',
        'transition-duration': '0.3s',
        'label': 'data(name)',
        'text-valign': 'center',
        'text-halign': 'right',
        'text-margin-x': 5,  // Add this line to move text to the right of the node
        'color': '#202020',  // Change this to dark grey
        'font-size': '10px',  // Make the font smaller
        'text-outline-width': 2,
        'text-outline-color': '#fff',
      },
    },
    {
      selector: '$node > node',
      style: {
        'padding-top': '10px',
        'padding-left': '10px',
        'padding-bottom': '10px',
        'padding-right': '10px',
        'background-color': '#f0f0f0',  // Light gray
        'background-opacity': 0.15,      // More transparent
        'border-color': '#d3d3d3',
        'border-width': '1px',
        'text-valign': 'top',
        'text-halign': 'center',
      }
    },
    {
      selector: 'node.group-node',
      style: {
        'background-color': '#e0e0e0',   // Light gray
        'background-opacity': 0.1,        // Very transparent
        'shape': 'roundrectangle',
        'text-valign': 'top',
        'text-halign': 'center',
        'font-weight': 'normal',         // Changed from bold to normal
        'font-size': '12px',             // Reduced from 14px
        'color': '#666666',              // Light gray text color
        'text-opacity': 0.7,             // Semi-transparent text
        'padding': '20px'
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
      selector: 'node[id = "' + id[i][0] + '"]',
      style: {
        backgroundColor: labelColor, 
        backgroundOpacity: 1,
        shape: shape, 
        borderWidth: borderWidth ? borderWidth : 0,
        borderColor: borderColor ? borderColor : 'transparent',
        width: size,
        height: size,
        label: id[i][1],
        'text-valign': 'center',
        'text-halign': 'right',
        'text-margin-x': 5,  // Add this line to move text to the right of the node
        'color': '#202020',  // Change this to dark grey
        'font-size': '10px',  // Make the font smaller
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
            cy={(cy) => {
              myCyRef.current = cy;
              // cy.fit();
              // cy.center();
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
              cy.bind('click', 'node', (evt) => {
                var node = evt.target;
                // Skip if this is a group node
                if (!node.hasClass('group-node')) {
                  props.handleSelect(node.data());
                  if (!props.informationOpen) {
                    props.expandInformation();
                  }
                }
              });
              cy.bind('click', 'edge', (evt) => {
                var edge = evt.target;
                console.log(edge.data());
                props.handleSelect(edge.data());
                if (!props.informationOpen) {
                  props.expandInformation();
                }
              });
            }}

          />
        </div>
      </div>
  );
}

export default Graph

import React, { useState, useEffect, useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import Cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import euler from 'cytoscape-euler';
import springy from 'cytoscape-springy'
import d3Force from 'cytoscape-d3-force';
import fcose from 'cytoscape-fcose';
import './scoped.css'

Cytoscape.use(fcose);
Cytoscape.use(cola);
Cytoscape.use(euler);
Cytoscape.use(d3Force);
Cytoscape.use(springy);

function Graph(props) {

  const [width, setWith] = useState('100%');
  const [height, setHeight] = useState('80vh');
 
  useEffect(() => {
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
  
  const graphData = useMemo(() => {
    let elements = {edges: [], nodes: []}
    for (let i in props.data.nodes) {
      let node = props.data.nodes[i].data
      if (node.frequency >= props.gtdcFreq[0] && node.frequency <= props.gtdcFreq[1] && 
          node.n_citation >= props.gtdcNoc[0] && node.n_citation <= props.gtdcNoc[1]) {
            elements.nodes.push(props.data.nodes[i])
          }
    }

    for (let i in props.data.edges) {
      let edge = props.data.edges[i].data
      if (elements.nodes.find((node) => node.data.id === edge.source) != undefined &&
      elements.nodes.find((node) => node.data.id === edge.target) != undefined) {
        elements.edges.push(props.data.edges[i])
      }
    }
    return elements;
  }, [props.gtdcFreq, props.gtdcNoc])

  let id = []
  for (var i in graphData.nodes) {
    id.push([graphData.nodes[i].data.id, graphData.nodes[i].data.label, graphData.nodes[i].data.frequency, graphData.nodes[i].data.n_citation, graphData.nodes[i].data.key_nodes])
  }

  const layout = {
    name: 'cola',
    egdeLengthVal: 200,
    nodeSpacing: 25,
    bundleEdges: true,
    // fit: true,
    // circle: true,
    // directed: true,
    // padding: 50,
    // // spacingFactor: 1.5,
    animate: false,
    animationDuration: 1,
    // avoidOverlap: true,
    // nodeDimensionsIncludeLabels: false,
  };

  const styleSheet = [
    {
      selector: 'node.hover',
      style: {
        'border-width': '6px',
        'border-color': '#AAD8FF',
        'border-opacity': '0.5',
        'background-color': '#77828C',
        width: 10,
        height: 10,
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
      selector: 'edge[label="Contain_vocab"]',
      style: {
        "curve-style": "haystack",
        // "curve-style": "unbundled-bezier",
    // "control-point-distances": 120,
    // "control-point-weights": 0.2,
        'width': 1,
        'opacity': 'mapData(weight, 1, 100, 0.1, 1)',
        // length: 1,
        // "line-color": "#6774cb",
        'line-color': '#FF7F50',
        // 'target-arrow-color': '#6774cb',
        // 'target-arrow-shape': 'triangle',
        // 'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="co_occur"]',
      style: {
        "curve-style": "haystack",
        // "curve-style": "unbundled-bezier",
    // "control-point-distances": 120,
    // "control-point-weights": 0.2,
    'width': 1,
    'opacity': 'mapData(weight, 1, 100, 0.1, 1)',
        // length: 1,
        // "line-color": "#6774cb",
        'line-color': '#008080',
        // 'target-arrow-color': '#6774cb',
        // 'target-arrow-shape': 'triangle',
        // 'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Semantic_relationship"]',
      style: {
        "curve-style": "haystack",
        // "curve-style": "unbundled-bezier",
    // "control-point-distances": 120,
    // "control-point-weights": 0.2,
        width: 1,
        'opacity': 'mapData(weight, 1, 100, 0.1, 1)',
        // length: 1,
        // "line-color": "#6774cb",
        'line-color': '#008080',
        // 'target-arrow-color': '#6774cb',
        // 'target-arrow-shape': 'triangle',
        // 'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Hierarchical_structure"]',
      style: {
        "curve-style": "haystack",
        // "curve-style": "unbundled-bezier",
    // "control-point-distances": 120,
    // "control-point-weights": 0.2,
        width: 1,
        'opacity': 'mapData(weight, 1, 100, 0.1, 1)',
        // length: 1,
        // "line-color": "#6774cb",
        'line-color': '#E0B0FF',
        // 'target-arrow-color': '#6774cb',
        // 'target-arrow-shape': 'triangle',
        // 'curve-style': 'bezier',
      },
    },
    {
      selector: 'edge[label="Curated_relationship"]',
      style: {
        "curve-style": "haystack",
        // "curve-style": "unbundled-bezier",
    // "control-point-distances": 120,
    // "control-point-weights": 0.2,
        'width': 1,
        'opacity': 'mapData(weight, 1, 100, 0.1, 1)',
        // length: 1,
        // "line-color": "#6774cb",
        'line-color': '#E0B0FF',
        // 'target-arrow-color': '#6774cb',
        // 'target-arrow-shape': 'triangle',
        // 'curve-style': 'bezier',
      },
    },
    {
      selector: 'node.highlight',
      style: {
          'border-color': '#FFF',
          'border-width': '2px'
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
    }
  ];
  for (var i in id) {
    let labelColor = ''
    let size = ''
    let shape = ''
    switch(id[i][1]) {
      case 'Anatomy':
        labelColor = '#E43333'
      break;
      case 'Chemicals and Drugs':
        labelColor = '#E8882F'
      break;
      case 'Diseases':
        labelColor = '#67BE48'
      break;
      case 'Genes and Gene Products':
        labelColor = '#46ACAC'
      break;
      case 'GO':
        labelColor = '#5782C2'
      break;
      case 'Organisms':
        labelColor = '#9B58C5'
      break;
      case 'Pathway':
        labelColor = '#D829B1'
      break;
    }
    if (id[i][2] >= 60) {
      size = 20
    } else if (id[i][2] < 60 && id[i][2] >= 30) {
      size = 10
    } else {
      size = 5
    }
    if (id[i][4] == "true") {
      shape = 'triangle'
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
        // backgroundColor: 'hsl(' + index*colorDif + ', 100%, ' + 50/label[index][1] * id[i][2] + '%)',
        width: size,
        height: size,
        label: 'data(display)',
        // height: 1+Math.log(id[i][2]),
        // width: 1+Math.log(id[i][2]),
        // "width": "mapData(score, 0, 0.006769776522008331, 20, 60)",
        // "height": "mapData(score, 0, 0.006769776522008331, 20, 60)",
        // "text-valign": "center",
        // "text-halign": "center",
        'overlay-padding': '8px',
        'z-index': '10',
        //text props
        'text-outline-color': 'white',
        'text-outline-width': '2px',
        color: '#666666',
        fontSize: 10,
      },
    })
  }
  // console.log(styleSheet)

  let myCyRef;
  return (
      <div>
        <div>
          <CytoscapeComponent
            key={JSON.stringify(graphData)}
            elements={CytoscapeComponent.normalizeElements(graphData)}
            // pan={{ x: 200, y: 200 }}
            style={{ width: width, height: height }}
            zoomingEnabled={true}
            maxZoom={2}
            minZoom={0.5}
            autounselectify={false}
            boxSelectionEnabled={true}
            layout={layout}
            stylesheet={styleSheet}
            cy={(cy) => {
              myCyRef = cy;
              cy.unbind("click");
              cy.on('click', function(e){
                var sel = e.target;
                if (sel.isNode) {
                  sel.visibility = 'hidden'
                  cy.elements().removeClass('semitransp');
                  cy.elements().removeClass('highlight');
                  cy.elements().difference(sel.outgoers().union(sel.incomers())).not(sel).addClass('semitransp');
                  sel.addClass('highlight').outgoers().union(sel.incomers()).addClass('highlight');

                  // Reduce opacity of non-highlighted elements
                  
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
                props.handleSelect(node.data());
                if (!props.informationOpen) {
                  props.handleInformation();
                }
              });
              cy.bind('click', 'edge', (evt) => {
                var edge = evt.target;
                console.log(edge.data());
                props.handleSelect(edge.data());
                if (!props.informationOpen) {
                  props.handleInformation();
                }
              });
            }}
          />
        </div>
      </div>
  );
}

export default Graph
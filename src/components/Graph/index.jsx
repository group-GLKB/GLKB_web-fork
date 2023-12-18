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
    let curMinAdcFreq = Number.MAX_SAFE_INTEGER;
    let curMaxAdcFreq = Number.MIN_SAFE_INTEGER;
    let curMinAdcPd = Number.MAX_SAFE_INTEGER;
    let curMaxAdcPd = Number.MIN_SAFE_INTEGER;
    let curMinAdcNoc = Number.MAX_SAFE_INTEGER;
    let curMaxAdcNoc = Number.MIN_SAFE_INTEGER;
    let curMinGtdcFreq = Number.MAX_SAFE_INTEGER;
    let curMaxGtdcFreq = Number.MIN_SAFE_INTEGER;
    let curMinGtdcNoc = Number.MAX_SAFE_INTEGER;
    let curMaxGtdcNoc = Number.MIN_SAFE_INTEGER;
    let articleArray = [];
    let termArray = [];
    let relationArray = [];
    const articleSet = new Set();
    const termSet = new Set();
    const relationSet = new Set();
    for (let i of props.data.nodes) {
      if (i.data.label == "Article") {
        curMinAdcFreq = Math.min(curMinAdcFreq, i.data.frequency);
        curMaxAdcFreq = Math.max(curMaxAdcFreq, i.data.frequency);
        curMinAdcPd = Math.min(curMinAdcPd, i.data.date);
        curMaxAdcPd = Math.max(curMaxAdcPd, i.data.date);
        curMinAdcNoc = Math.min(curMinAdcNoc, i.data.n_citation);
        curMaxAdcNoc = Math.max(curMaxAdcNoc, i.data.n_citation);
        if (!articleSet.has(i.data.display)) {
          let temp = {
            key: (articleArray.length + 1).toString(),
            title: i.data.display,
            description: 'article'
          }
          articleArray.push(temp)
          articleSet.add(i.data.display)
        }
      }
      else if (i.data.label != "Event") {
        curMinGtdcFreq = Math.min(curMinGtdcFreq, i.data.frequency);
        curMaxGtdcFreq = Math.max(curMaxGtdcFreq, i.data.frequency);
        curMinGtdcNoc = Math.min(curMinGtdcNoc, i.data.n_citation);
        curMaxGtdcNoc = Math.max(curMaxGtdcNoc, i.data.n_citation);
        if (!termSet.has(i.data.display)) {
          let temp = {
            key: (termArray.length + 1).toString(),
            title: i.data.display,
            description: 'genomic',
            label: i.data.label
          }
          termArray.push(temp)
          termSet.add(i.data.display)
        }
      }
      else {
        if (!articleSet.has(i.data.display)) {
          let temp = {
            key: (articleArray.length + 1).toString(),
            title: i.data.display
          }
          articleArray.push(temp);
          articleSet.add(i.data.display);
        }
      }
    }
    for (let i of props.data.edges) {
      if (!relationSet.has(i.data.label)) {
        let temp = {
          key: (relationArray.length + 1).toString(),
          title: i.data.label
        }
        relationArray.push(temp);
        relationSet.add(i.data.label);
      }
      if (i.data.dates.length != 0) {
        curMinAdcPd = Math.min(curMinAdcPd, i.data.dates[0].year);
        curMaxAdcPd = Math.max(curMaxAdcPd, i.data.dates[0].year);
      }
    }
    props.handleMinAdcFreq(curMinAdcFreq);
    props.handleMaxAdcFreq(curMaxAdcFreq);
    props.handleAdcFreq([curMinAdcFreq, curMaxAdcFreq]);
    props.handleMinAdcPd(curMinAdcPd);
    props.handleMaxAdcPd(curMaxAdcPd);
    props.handleAdcPd([curMinAdcPd, curMaxAdcPd]);
    props.handleMinAdcNoc(curMinAdcNoc);
    props.handleMaxAdcNoc(curMaxAdcNoc);
    props.handleAdcNoc([curMinAdcNoc, curMaxAdcNoc]);
    props.handleMinGtdcFreq(curMinGtdcFreq);
    props.handleMaxGtdcFreq(curMaxGtdcFreq);
    props.handleGtdcFreq([curMinGtdcFreq, curMaxGtdcFreq]);
    props.handleMinGtdcNoc(curMinGtdcNoc);
    props.handleMaxGtdcNoc(curMaxGtdcNoc);
    props.handleGtdcNoc([curMinGtdcNoc, curMaxGtdcNoc]);
    props.setArticleNodes(articleArray);
    props.setVisibleArticles(articleArray);
    props.setTermNodes(termArray);
    props.setVisibleTerms(termArray);
    props.setRelationNodes(relationArray);
    props.setVisibleRelations(relationArray);
  }, [props.data]);

  
  let articleView={"edges":[], "nodes":[]}
  let termView={"edges":[], "nodes":[]}
  let articleTermView={"edges":[], "nodes":[]}
  for (var i in props.data.nodes) {
    if (props.data.nodes[i].data.label === "Article") {
      articleView.nodes.push(props.data.nodes[i])
    }
    if (props.data.nodes[i].data.label !== "Article" && props.data.nodes[i].data.label !== "Event" ) {
      termView.nodes.push(props.data.nodes[i])
    }
    if (props.data.nodes[i].data.label !== "Event" ) {
      articleTermView.nodes.push(props.data.nodes[i])
    }
  }
  for (var i in props.data.edges) {
    if (props.data.edges[i].data.label === "Cite") {
      articleView.edges.push(props.data.edges[i])
    }
    if (props.data.edges[i].data.label !== "Cite" && props.data.edges[i].data.label !== "Contain_vocab" ) {
      if (termView.nodes.includes(props.data.nodes.find((node) => node.data.id === props.data.edges[i].data.source)) && termView.nodes.includes(props.data.nodes.find((node) => node.data.id === props.data.edges[i].data.target))) {
        termView.edges.push(props.data.edges[i])
      }
    }
    if (props.data.edges[i].data.label === "Contain_vocab") {
      articleTermView.edges.push(props.data.edges[i])
    }
  }
  // console.log(articleView)
  
  const graphData = useMemo(() => {
    let elements = {edges: [], nodes: []}
    for (let i in props.data.nodes) {
      let node = props.data.nodes[i].data
      if (node.frequency >= props.gtdcFreq[0] && node.frequency <= props.gtdcFreq[1] && 
          node.n_citation >= props.gtdcNoc[0] && node.n_citation <= props.gtdcNoc[1] &&
          props.visibleTerms.find(item => item.title === node.display)) {
            elements.nodes.push(props.data.nodes[i])
          }
    }

    for (let i in props.data.edges) {
      let edge = props.data.edges[i].data
      if (elements.nodes.find((node) => node.data.id === edge.source) != undefined &&
      elements.nodes.find((node) => node.data.id === edge.target) != undefined &&
      props.visibleRelations.find(item => item.title === edge.label)) {
        elements.edges.push(props.data.edges[i])
      }
    }
    if (elements.edges.length != 0) {
      for (let i = 0; i < elements.edges.length; i++) {
        elements.edges[i].data.weight = 0;
        if (elements.edges[i].data.dates.length != 0) {
          for (var j = 0; j < elements.edges[i].data.dates.length; j++) {
            if (elements.edges[i].data.dates[j].year >= props.adcPd[0] && elements.edges[i].data.dates[j].year <= props.adcPd[1]) {
              elements.edges[i].data.weight += elements.edges[i].data.dates[j].weight;
            }
          }
        }
        if (elements.edges[i].data.weight <= 0) {
          elements.edges[i].data.weight = 1;
        }
      }
    }
    return elements;
  }, [props.adcFreq, props.adcPd, props.adcNoc, props.gtdcFreq, props.gtdcNoc, props.visibleArticles, props.visibleTerms, props.visibleRelations])

  let label = [['Anatomy', 0],['Article', 0],['Chemicals and Drugs', 0],['Diseases', 0],['GO', 0],['Genes and Gene Products', 0],['Journal', 0],['Organisms', 0],['Pathway', 0]]
  let id = []
  for (var i in graphData.nodes) {
    if (label.find(pair => pair.includes(graphData.nodes[i].data.label)) == undefined) {
      label.push([graphData.nodes[i].data.label, graphData.nodes[i].data.frequency])
    }
    if (label.find(pair => pair.includes(graphData.nodes[i].data.label))[1] < graphData.nodes[i].data.frequency) {
      label.find(pair => pair.includes(graphData.nodes[i].data.label))[1] = graphData.nodes[i].data.frequency
    }
    id.push([graphData.nodes[i].data.id, graphData.nodes[i].data.label, graphData.nodes[i].data.frequency, graphData.nodes[i].data.n_citation, graphData.nodes[i].data.key_nodes])
  }
  // console.log(label)
  const colorDif = 360 / 9
  // console.log(eventStyle)

  // console.log(graphData);

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
    // {
    //   selector: 'node[label = "Event"]',
    //   style: {
    //     backgroundColor: 'hsl(0, 100%, 50%)',
    //     width: 10,
    //     height: 10,
    //     label: 'data(name)',

    //     // "width": "mapData(score, 0, 0.006769776522008331, 20, 60)",
    //     // "height": "mapData(score, 0, 0.006769776522008331, 20, 60)",
    //     // "text-valign": "center",
    //     // "text-halign": "center",
    //     'overlay-padding': '8px',
    //     'z-index': '10',
    //     //text props
    //     'text-outline-color': '#4a56a6',
    //     'text-outline-width': '2px',
    //     color: 'white',
    //     fontSize: 10,
    //   },
    // },
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
        style:{ 'opacity': '0.5' }
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
    const index = label.findIndex((pair) => {
      return pair[0] === id[i][1]
    })
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
              // cy.bind("click", props.handleSelectNode)
    //         cy.nodes('[label = "Event"]').style({'background-color': 'white',
    // 'color': 'black'});
              // cy.on('mouseover', 'node', function(e){
              //     var sel = e.target;
              //     cy.elements().difference(sel.incomers()).not(sel).addClass('semitransp');
              //     sel.addClass('highlight').incomers().addClass('highlight');
              // });
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
                  props.closeTable();
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
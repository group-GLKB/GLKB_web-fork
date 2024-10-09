import Cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import euler from 'cytoscape-euler';
import springy from 'cytoscape-springy';
import d3Force from 'cytoscape-d3-force';
import fcose from 'cytoscape-fcose';

export function initializeCytoscape() {
    Cytoscape.use(fcose);
    Cytoscape.use(cola);
    Cytoscape.use(euler);
    Cytoscape.use(d3Force);
    Cytoscape.use(springy);
}

export function createLayout() {
    return {
        name: 'cola',
        egdeLengthVal: 200,
        nodeSpacing: 25,
        bundleEdges: true,
        animate: false,
        animationDuration: 1,
    };
}

export function createStyleSheet(nodeIds) {
    const baseStyleSheet = [
        {
            selector: 'node',
            style: {
                'label': 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'text-wrap': 'wrap',
                'text-max-width': '100px',
                'font-size': '8px',
                'color': '#000000',
            }
        },
        {
            selector: 'edge',
            style: {
                'width': 1,
                'line-color': '#ccc',
                'target-arrow-color': '#ccc',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier'
            }
        },
        {
            selector: '.semitransp',
            style: {
                'opacity': 0.2
            }
        },
        {
            selector: '.highlight',
            style: {
                'opacity': 1
            }
        },
        {
            selector: '.hover',
            style: {
                'border-width': '2px',
                'border-color': '#000'
            }
        }
    ];

    const nodeStyles = nodeIds.map(id => ({
        selector: `node[id = "${id[0]}"]`,
        style: {
            backgroundColor: getLabelColor(id[1]),
            backgroundOpacity: 1,
            shape: id[4] === "true" ? 'ellipse' : 'ellipse',
            width: getNodeSize(id[2]),
            height: getNodeSize(id[2]),
            borderWidth: id[4] === "true" ? '1px' : 0,
            borderColor: id[4] === "true" ? 'red' : 'transparent',
        },
    }));

    return [...baseStyleSheet, ...nodeStyles];
}

function getLabelColor(label) {
    // Add your label color logic here
    return '#000000'; // Default color
}

function getNodeSize(frequency) {
    if (frequency >= 60) return 40;
    if (frequency >= 30) return 30;
    return 20;
}
import axios from 'axios';

export class CypherService {
    constructor() { }
    async Article2Cypher(content) {
        // console.log('article to cypher')
        // console.log(content)
        let res = []
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            params: {
                name: content
            }
        }
        await axios
            .get("/api/v1/graphs/term-graph", config)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }

    async Triplet2Cypher(content) {
        // console.log('triplet to cypher');
        // console.log(content);
        let res = [];
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };

        if (content.params && !content.params.type) {
            content.params.type = 'All';
        }

        await axios
            .post("/api/v1/graphs/triplet2graph", JSON.stringify(content), config)
            // .post("/frontend/frontend_triplet2graph", JSON.stringify(content), config)
            .then(function (response) {
                res = response.data;
                // console.log('response', response.data);
            })
            .catch(function (error) {
                console.log('error', error);
            });
        // console.log(res)
        return res;
    }

    async Entity2Cypher(content, type = 'All') {
        // console.log('entity to cypher')
        // console.log('content:', content)
        // console.log('type:', type)
        let res = []
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            params: {
                name: content,
                ent_type: type
            }
        }
        await axios
            .get("/api/v1/search/entity-name-search", config)
            // .get("/frontend/entity_search", config)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }

    async Term2Article(content) {
        // console.log('term to article');
        // console.log('Request content:', content);
        let res = [];
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
        await axios
            .post("/api/v1/graphs/ent2art-graph", JSON.stringify(content), config)
            // .post("/frontend/frontend_ent2art_graph", JSON.stringify(content), config)
            .then(function (response) {
                res = response.data;
                // Log detailed edge information
                // console.log('Response data details:', {
                //     totalEdges: response.data.edges?.length,
                //     edgeSample: response.data.edges?.slice(0, 3).map(e => ({
                //         source: e.data?.source,
                //         target: e.data?.target,
                //         type: e.data?.type,
                //         id: e.data?.id
                //     })),
                //     uniqueSources: new Set(response.data.edges?.map(e => e.data?.source)).size,
                //     uniqueTargets: new Set(response.data.edges?.map(e => e.data?.target)).size,
                //     duplicateEdges: response.data.edges?.filter((e1, i) =>
                //         response.data.edges.findIndex(e2 =>
                //             e2.data?.source === e1.data?.source &&
                //             e2.data?.target === e1.data?.target
                //         ) !== i
                //     ).length
                // });
            })
            .catch(function (error) {
                console.log('error', error);
            });

        return res;
    }

    async generateAnswer(params) {
        // console.log('generating answer');
        // console.log('params:', params.toString());
        let res = '';
        try {
            const response = await axios.get("/api/frontend/frontend_qa", { params });
            // const response = await axios.get("/frontend/frontend_qa", { params });
            res = response.data;
            // console.log('response:', res);
        } catch (error) {
            console.error('Error fetching answer:', error);
            res = 'An error occurred while fetching the answer.';
        }
        return res;
    }

    async generateFreeAnswer(questionData) {
        // console.log('Generating free answer for:', questionData);
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };

        try {
            // Send the question data directly
            // const response = await axios.post("/frontend/frontend_qa", questionData, config);
            const response = await axios.post("/api/frontend/frontend_qa", questionData, config);
            return response.data;
        } catch (error) {
            console.error('Error fetching free answer:', error);
            throw error;
        }
    }

    async Neighbor2Cypher(nid, type, limit, rel_type, name) {
        // console.log('neighbor to cypher')
        // console.log({ nid, type, limit, rel_type, name })
        let res = []
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            params: {
                nid: nid,
                name: name,
                type: type,
                limit: limit,
                rel_type: rel_type
            }
        }
        await axios
            // .get("/frontend/frontend_neighbor_graph", config)
            .get("/api/v1/graphs/neighbor-graph", config)
            .then(function (response) {
                res = response.data
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }
}

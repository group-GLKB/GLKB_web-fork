import axios from 'axios'

export class CypherService {
    constructor() {}
    async Article2Cypher(content) {
        console.log('article to cypher')
        console.log(content)
        let res = []
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            params: {
                query: content
            }
        }
        await axios
            // .get("/api/frontend/frontend_term2graph?query=" + content)
            .get("/frontend/frontend_term2graph?query=" + content)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }

    async Triplet2Cypher(content) {
        console.log('triplet to cypher');
        console.log(content);
        let res = [];
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
        await axios
            // .post("/api/frontend/frontend_triplet2graph", JSON.stringify(content), config)
            .post("/frontend/frontend_triplet2graph", JSON.stringify(content), config)
            .then(function (response) {
                res = response.data;
                let queryParams = new URLSearchParams();
                // queryParams.append('data', JSON.stringify(res));
                // let queryString = queryParams.toString();
                // let resultPageURL = '/result?' + JSON.stringify(content);

                // Redirect the user to the result page
                // window.location.href = resultPageURL;
                // window.location.href = '/result'
                console.log('response', response.data);
            })
            .catch(function (error) {
                console.log('error', error);
            });
        console.log(res)
        return res;
    }

    async Entity2Cypher(content) {
        console.log('entity to cypher')
        console.log(content)
        let res = []
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            params: {
                query: content
            }
        }
        await axios
            // .get("/api/frontend/entity_search?query=" + content)
            .get("/frontend/entity_search?query=" + content)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }
    
    async Term2Article(content) {
        console.log('term to article');
        console.log(content);
        let res = [];
        var config = {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        };
        await axios
            // .post("/api/frontend/frontend_ent2art_graph", JSON.stringify(content), config)
            .post("/frontend/frontend_ent2art_graph", JSON.stringify(content), config)
            .then(function (response) {
                res = response.data;
                console.log('response', response.data);
            })
            .catch(function (error) {
                console.log('error', error);
            });
        
        return res;
    }

    async generateAnswer(params) {
        console.log('generating answer');
        console.log('params:', params.toString());
        let res = '';
        try {
            // const response = await axios.get("/api/frontend/frontend_qa", { params });
            const response = await axios.get("/frontend/frontend_qa", { params });
            res = response.data;
            console.log('response:', res);
        } catch (error) {
            console.error('Error fetching answer:', error);
            res = 'An error occurred while fetching the answer.';
        }
        return res;
    }
}
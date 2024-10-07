import { ConsoleSqlOutlined } from '@ant-design/icons'
import axios from 'axios'

export class DetailService {
    constructor() {}
    async Nid2Detail(nid) {
        console.log('node to detail')
        let res = []
        await axios
            .get('/frontend/frontend_node_detail/' + nid)
            // .get('/api/frontend/frontend_node_detail/' + nid)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        console.log(res)
        return res
    }
    async Eid2Detail(Source, Target) {
        console.log('edge to detail')
        let res = []
        await axios
            .get('/frontend/frontend_rel_detail_mult/' + Source + '/' + Target)
            // .get('/api/frontend/frontend_rel_detail_mult/' + Source + '/' + Target)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }

    async MergeNid2Detail(nid) {
        console.log('merge node to detail')
        const queryString = nid.map(id => `nid=${id}`).join('&');
        let res = []
        await axios
            .get('frontend/frontend_multi_node_detail?' + queryString)
            // .get('/api/frontend/frontend_multi_node_detail?' + queryString)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        console.log(res)
        console.log(res.data[0].some(entity => 'database_id' in entity))
        return res
    }

    async MergeEid2Detail(eid) {
        console.log('merge edge to detail')
        const queryString = eid.map(id => `eid=${id}`).join('&');
        let res = []
        await axios
            .get('/frontend/frontend_rel_detail_mult?' + queryString)
            // .get('/api/frontend/frontend_rel_detail_mult?' + queryString)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        console.log(res)
        return res
    }
}
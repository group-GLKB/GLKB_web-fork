import { ConsoleSqlOutlined } from '@ant-design/icons'
import axios from 'axios'

export class DetailService {
    constructor() {}
    async Nid2Detail(nid) {
        console.log('[GraphDebug] DetailService.Nid2Detail called with nid:', nid)
        let res = []
        await axios
            .get('/api/frontend/frontend_node_detail/' + nid)
            // .get('/frontend/frontend_node_detail/' + nid)
            .then(function (response) {
                console.log(response)
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        console.log(res)
        return res
    }
    async Eid2Detail(Source, Target) {
        console.log('[GraphDebug] DetailService.Eid2Detail called with source/target:', Source, Target)
        let res = []
        await axios
            .get('/api/v1/search/rel-detail-mult' + Source + '/' + Target)
            // .get('/frontend/frontend_rel_detail_mult/' + Source + '/' + Target)
            .then(function (response) {
                console.log(response)
                res = response
               
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }

    async MergeNid2Detail(nid) {
        console.log('[GraphDebug] DetailService.MergeNid2Detail called with nid list:', nid)
        const queryString = nid.map(id => `nid=${id}`).join('&');
        console.log('[GraphDebug] DetailService.MergeNid2Detail query:', queryString)
        let res = []
        await axios
            .get('/api/v1/search/multi-node-detail?' + queryString)
            // .get('/frontend/frontend_multi_node_detail?' + queryString)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        console.log(res)
        if (res?.data?.[0] && Array.isArray(res.data[0])) {
            console.log(res.data[0].some(entity => 'database_id' in entity))
        }
        return res
    }

    async MergeEid2Detail(eid) {
        console.log('[GraphDebug] DetailService.MergeEid2Detail called with eid list:', eid)
        const queryString = eid.map(id => `eid=${id}`).join('&');
        console.log('[GraphDebug] DetailService.MergeEid2Detail query:', queryString)
        let res = []
        await axios
            .get('/api/v1/search/rel-detail-mult?' + queryString)
            // .get('/frontend/frontend_rel_detail_mult?' + queryString)
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

import { ConsoleSqlOutlined } from '@ant-design/icons'
import axios from 'axios'

export class DetailService {
    constructor() {}
    async Nid2Detail(nid) {
        console.log('node to detail')
        let res = []
        await axios
            // .get('/frontend/frontend_node_detail/' + nid)
            .get('/api/frontend/frontend_node_detail/' + nid)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }
    async Eid2Detail(Source, Target) {
        console.log('edge to detail')
        let res = []
        await axios
            // .get('/frontend/frontend_rel_detail_mult/' + Source + '/' + Target)
            .get('/api/frontend/frontend_rel_detail_mult/' + Source + '/' + Target)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }
}
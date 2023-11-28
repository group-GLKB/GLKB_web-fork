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
        return res
    }
    async Eid2Detail(Eid) {
        console.log('edge to detail')
        let res = []
        await axios
            .get('/frontend/frontend_rel_detail/' + Eid)
            // .get('/api/frontend/frontend_rel_detail/' + Eid)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }
}
import { ConsoleSqlOutlined } from '@ant-design/icons'
import axios from 'axios'

export class NewGraph {
    constructor() {}
    async AddNodes(existing, newNode) {
        console.log('add nodes')
        let res = []
        await axios
            //.get('/frontend/frontend_add_nodes?existing=' + existing + "&new=" + newNode)
            .get('https://glkb.dcmb.med.umich.edu/api/frontend/frontend_add_nodes?existing=' + existing + "&new=" + newNode)
            .then(function (response) {
                res = response
            })
            .catch(function (error) {
                console.log('error', error)
            })
        return res
    }
}
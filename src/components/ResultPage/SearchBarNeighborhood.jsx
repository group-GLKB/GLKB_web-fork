import React from 'react';

import SearchBarNeighborhood from '../Units/SearchBarNeighborhood';

const ResultSearchBarNeighborhood = React.forwardRef((props, ref) => (
    <SearchBarNeighborhood ref={ref} {...props} />
));

export default ResultSearchBarNeighborhood;

import React from 'react';

import SearchBarKnowledge from '../Units/SearchBarKnowledge';

const ResultSearchBarKnowledge = React.forwardRef((props, ref) => (
    <SearchBarKnowledge ref={ref} {...props} />
));

export default ResultSearchBarKnowledge;

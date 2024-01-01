// NavBar.js

import React, { useState, useRef, useEffect } from 'react';
import './scoped.css'; // Make sure to import the CSS file
import MedSchoolLogo from '../../img/MedSchoolLogo.png';

const NavBar = () => {
    const [input, setInput] = useState('');
    const [tags, setTags] = useState([]);
    const inputRef = useRef(null);

    const handleInputChange = (e) => {
        setInput(e.target.textContent);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (input.trim()) {
                // If there is input, create a bubble
                setTags([...tags, input.trim()]);
                setInput('');
                e.target.textContent = '';
            } else if (tags.length > 0) {
                // If there is no input but there are tags, trigger search
                handleSearch();
            }
        } else if (e.key === 'Backspace' && !input) {
            // Delete the last tag if there is no input
            e.preventDefault();
            setTags(tags.slice(0, -1));
        }
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [tags]);

    const handleSearch = () => {
        // Perform search using the tags array
        console.log('Searching for:', tags);
        // Implement the search logic here
        // Clear the tags if needed after search
        setTags([]);
    };

    return (
        <nav className="navbar">
            <div className="navbar-container">
                {/* ... logo and other links ... */}

                <div className="search-bar">
                    <div className="logo">
                        <a href="/">
                            <img src={MedSchoolLogo} alt="MedSchoolLogo" />
                        </a>
                    </div>
                    <div className="logo">
                        <a href="/">Home</a>
                    </div>
                    <div className="logo">
                        <a href="https://glkb.dcmb.med.umich.edu/docs" target="_blank">API Doc</a>
                    </div>
                    <div className="search-input" onClick={() => inputRef.current && inputRef.current.focus()}>
                        {tags.map((tag, index) => (
                            <span key={index} className="search-tag">
                                {tag}
                                <span className="delete-tag" onClick={() => setTags(tags.filter((_, i) => i !== index))}>&times;</span>
                            </span>
                        ))}
                        <span
                            ref={inputRef}
                            contentEditable
                            className="editable-input"
                            onInput={handleInputChange}
                            onKeyDown={handleKeyDown}
                            role="textbox"
                            aria-multiline="false"
                        />
                    </div>
                    <button type="button" onClick={handleSearch}>Search</button>
                </div>
            </div>
        </nav>
    );
};

export default NavBar;



// // NavBar.js
//
// import React, { useState, useRef, useEffect } from 'react';
// import './scoped.css'; // Make sure to import the CSS file
// import MedSchoolLogo from '../../img/MedSchoolLogo.png';
// import {useNavigate} from "react-router-dom";
// import {CypherService} from "../../service/Cypher";
//
// const NavBar = () => {
//     const [input, setInput] = useState('');
//     const [tags, setTags] = useState([]);
//     const inputRef = useRef(null);
//
//     const handleInputChange = (e) => {
//         setInput(e.target.textContent);
//     };
//
//     const handleKeyDown = (e) => {
//         if (e.key === 'Enter') {
//             e.preventDefault();
//             if (input.trim() !== '') {
//                 setTags([...tags, input]);
//                 setInput('');
//                 e.target.textContent = '';
//             }
//         } else if (e.key === 'Backspace' && !input) {
//             // Delete the last tag if there is no input
//             e.preventDefault();
//             setTags(tags.slice(0, -1));
//         }
//     };
//
//     useEffect(() => {
//         if (inputRef.current) {
//             inputRef.current.focus();
//         }
//     }, [tags]);
//
//     // const handleSearch = () => {
//     //     // Perform search using the tags array
//     //     console.log('Searching for:', tags);
//     //     // Implement the search logic here
//     // };
//     let nevigate = useNavigate();
//     const handleSearch = async (v) => {
//         initialize()
//         nevigate(`/result?q=${v}`)
//         search(v)
//     }
//     async function search(content) {
//         setSearchFlag(false)
//         nevigate(`/result?q=${content}`)
//         let cypherServ = new CypherService()
//         const response = await cypherServ.Article2Cypher(content)
//         console.log('function -> ', response)
//         // setData(graphData)
//         setData(response.data[0])
//         setAllNodes(response.data[1])
//         setSearchFlag(true)
//     }
//
//     const handleInputConfirm = (e) => {
//         console.log('Searching for:', tags);
//         setSearchText('');
//         if (!inputValue && tags.length != 0) {
//             handleSearch(tags.join("|"));
//         }
//         if (inputValue && tags.indexOf(inputValue) === -1) {
//             setTags([...tags, inputValue]);
//         }
//         setInputVisible(false);
//         setInputValue("");
//     };
//
//
//
//     return (
//         <nav className="navbar">
//             <div className="navbar-container">
//                 <div className="logo">
//                     <a href="/">
//                         <img src={MedSchoolLogo} alt="MedSchoolLogo" />
//                     </a>
//                 </div>
//                 <div className="logo">
//                     <a href="/">Home</a>
//                 </div>
//                 <div className="logo">
//                     <a href="https://glkb.dcmb.med.umich.edu/docs" target="_blank">API Doc</a>
//                 </div>
//
//                 <div className="search-bar">
//                     <div className="search-input" onClick={() => inputRef.current && inputRef.current.focus()}>
//                         {tags.map((tag, index) => (
//                             <span key={index} className="search-tag">
//                                 {tag}
//                                 <span className="delete-tag" onClick={() => setTags(tags.filter((_, i) => i !== index))}>&times;</span>
//                             </span>
//                         ))}
//                         <span
//                             ref={inputRef}
//                             contentEditable
//                             className="editable-input"
//                             onInput={handleInputChange}
//                             onKeyDown={handleKeyDown}
//                             role="textbox"
//                             aria-multiline="false"
//                         />
//                     </div>
//                     <button type="button" onClick={handleInputConfirm}>Search</button>
//                 </div>
//             </div>
//         </nav>
//     );
// };
//
// export default NavBar;

// // NavBar.js
//
// import React, { useState } from 'react';
// import './scoped.css'; // Make sure to import the CSS file
// import MedSchoolLogo from '../../img/MedSchoolLogo.png';
//
// const NavBar = () => {
//     const [input, setInput] = useState('');
//     const [tags, setTags] = useState([]);
//
//     const handleInputChange = (e) => {
//         setInput(e.target.value);
//     };
//
//     const handleInputKeyDown = (e) => {
//         if (e.key === 'Enter' && input) {
//             setTags([...tags, input]);
//             setInput('');
//         }
//     };
//
//     const handleSearch = () => {
//         // Perform search using the tags array
//         console.log('Searching for:', tags);
//         // Here you would implement your search logic or call to your search function
//     };
//
//     return (
//         <nav className="navbar">
//             <div className="navbar-container">
//                 <div className="logo">
//                     <a href="/">
//                         <img src={MedSchoolLogo} alt="MedSchoolLogo" />
//                     </a>
//                 </div>
//                 <div className="logo">
//                     <a href="/">Home</a>
//                 </div>
//                 <div className="logo">
//                     <a href="https://glkb.dcmb.med.umich.edu/docs" target="_blank">API Doc</a>
//                 </div>
//
//                 <div className="search-bar">
//                     {tags.map((tag, index) => (
//                         <span key={index} className="search-tag">
//                             {tag}
//                         </span>
//                     ))}
//                     <input
//                         type="text"
//                         placeholder="Search..."
//                         value={input}
//                         onChange={handleInputChange}
//                         onKeyDown={handleInputKeyDown}
//                     />
//                     <button type="button" onClick={handleSearch}>Search</button>
//                 </div>
//                 {/* Add more navbar items here if needed */}
//             </div>
//         </nav>
//     );
// };
//
// export default NavBar;




// // NavBar.js
//
// import React from 'react';
// import './scoped.css'; // Make sure to import the CSS file
// import MedSchoolLogo from '../../img/MedSchoolLogo.png'
//
// const NavBar = () => {
//     return (
//         <nav className="navbar">
//             <div className="navbar-container">
//                 <div className="logo">
//                     <a href="/">
//                         <img src={MedSchoolLogo} alt="MedSchoolLogo" />
//                     </a>
//                 </div>
//                 <div className="logo">
//                     <a href="/">Home</a>
//                 </div>
//                 <div className="logo">
//                     <a href="https://glkb.dcmb.med.umich.edu/docs" target="_blank">API Doc</a>
//                 </div>
//
//                 <div className="search-bar">
//                     <input type="text" placeholder="Search..." />
//                     <button type="submit">Search</button>
//                 </div>
//                 {/* Add more navbar items here if needed */}
//             </div>
//         </nav>
//     );
// };
//
// export default NavBar;

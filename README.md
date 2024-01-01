# GLKB_web

## NavBar Connecting to Backend API (branch 5)
The latest version is pushed at the branch yijia/5/revise-nav-bar.

(Only adding the /NavBar component)

All the input contents will be stored in the array tags. 

Revise the NavBar\index.jsx line 41 - 47 to handle the search (api) and add some states (?)

Handle search is called at line 83 and line 26 

(corresponding to situation 1: click on search button and situation2: keyboard enter with no current input)

```js
    const handleSearch = () => {
        // Perform search using the tags array
        console.log('Searching for:', tags);
        // Implement the search logic here
        // Clear the tags if needed after search
        setTags([]);
    };
```

## Set the information header to the node detail name (branch 4)
The latest version is pushed at the branch yijia/4/revise-right-form-header

- Fix the problem of only showing the sample data for edge details
- Revise the name for the form header

Only revise the file src/components/Information/index.jsx

##NOTE!!: Suggest merging branch 4 to master first and then 5

const SetProviders = async (resultsCat) => {
    // Help from https://www.w3schools.com/jsref/jsref_join.asp
    if (resultsCat) {
      let array = []
      for (let i = 0; i < resultsCat.length; i++) {
        array.push(resultsCat[i].provider_name)
      }
      return array.join(", ")
    } else {
      return ""
    }
}

export default SetProviders;

/*

Other Resources used:
- https://www.freecodecamp.org/news/check-if-an-object-is-empty-in-javascript/

Other notable resources:
- https://www.sitepoint.com/loop-through-json-response-javascript/
- https://www.geeksforgeeks.org/how-to-iterate-over-a-javascript-object/
- https://www.freecodecamp.org/news/check-if-an-object-is-empty-in-javascript/
- https://stackoverflow.com/questions/66895449/how-to-iterate-through-2d-array-and-filter-single-values-from-the-array
- https://stackoverflow.com/questions/10021847/for-loop-in-multidimensional-javascript-array

*/
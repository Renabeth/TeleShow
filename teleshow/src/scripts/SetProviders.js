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

*/
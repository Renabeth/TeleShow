const options = {
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0MjUwMGFiYmI0NGM1ZjY1NzQ1NjcwYmFjNjJiYTBmMyIsIm5iZiI6MTczOTY1NDg0OC45NzEsInN1YiI6IjY3YjEwNmMwNDdkYmZiYTQ2NDZjNjQwNyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.H1gvMOTTjeRQK8AUxv7ARrGLj8htx-lYEVcB8gp0njA'
        //API read access token
    }
};

fetch('https://api.themoviedb.org/3/authentication', options)
    .then(res => res.json())
    .then(res => console.log(res))
    .catch(err => console.error(err));


//fetch company id
fetch('https://api.themoviedb.org/3/company/company_id', options)
    .then(res => res.json())
    .then(res => console.log(res))
    .catch(err => console.error(err));

//fetch discover movie
fetch('https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=popularity.desc', options)
    .then(res => res.json())
    .then(res => console.log(res))
    .catch(err => console.error(err));

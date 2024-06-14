document.querySelectorAll('nav-links a').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});


const createAcc = document.getElementById('createBIZ');
createAcc.onclick=function(){
    alert('You are about to create a Business Account')
}

const createAccPS = document.getElementById('createPS');
createAccPS.onclick=function(){
    alert('You are about to create a Personal Account')
}

const signUp = document.getElementById('signup1');
createAccPS.onclick=function(){
    alert('thank you for signing up with Us ')
}
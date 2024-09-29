const bgContainer = document.getElementById("bg-container");
const balls = document.getElementsByClassName("bg-ball");
const perspectiveFactor = 0.5;

const pos = [[19, 61], [52, 95], [73, 22]];
const scales = [0.70, 0.55, 0.9];
const T = [8500, 14600, 12000]
const A = [15, 30, 20]
const phi = [0, 3, 1.5]


function animation(time) {
    for (let i = 0; i < 3; i++) {
        const x = A[i] * Math.cos(2 * Math.PI * time / T[i] + phi[i]);
        const y = A[i] * Math.sin(2 * Math.PI * time / T[i] + phi[i]);
        balls[i].style.transform = `translateX(${x}px) translateY(${y - perspectiveFactor * window.scrollY}px)`
    }
    requestAnimationFrame(animation);
}

window.onload = () => {
    for (let i = 0; i < 3; i++) {
        balls[i].style.left = `${pos[i][0]}vw`;
        balls[i].style.top = `${pos[i][1]}vh`;
        balls[i].style.width = `${scales[i] * 300}px`;
        balls[i].style.height = `${scales[i] * 300}px`;
        balls[i].style.marginTop = `-${scales[i] * 150}px`;
        balls[i].style.marginLeft = `-${scales[i] * 150}px`;
    }
    requestAnimationFrame(animation);
}

// window.onscroll = () => {
//     bgContainer.style.transform = `translateY(-${perspectiveFactor * window.scrollY}px)`;
// }

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});
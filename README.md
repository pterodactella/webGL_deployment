### Semi-Lagrangian fluid simulation in WebGL

1. It's using a combination of the Eulerian Grid with the Lagrangian Particle approach. The so called "particles" are stored in a dynamic array of pointers that contain the properties of each "particle". New particles/pointer are added when the user interacts with the virtual canvas.
2. It's built using WebGL and GLSL
3. The shaders aim to approximate the Navier Stokes equations. For the advection term, backward advection is used (which is possible because of the pointer array. It works by looking back in time on how the fluid was previously advected and use those values to approximate a new one)
4. It's using the Pressure Poisson equation and for solving it we use the Jacobi Iterative method.
5. Assumptions needed for aproximating the Navier Stokes eq: Newtonian Incompressible fluid


Demo: http://danielasmasterthesis.netlify.app/

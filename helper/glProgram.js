class GLProgram {
    constructor(gl, vertexShaderSource, fragmentShaderSource) {
        this.gl = gl;
        this.uniforms = {};
        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        this.retrieveUniforms();
    }

    createProgram(vertexShaderSource, fragmentShaderSource) {
        let program = this.gl.createProgram();

        this.gl.attachShader(program, vertexShaderSource);
        this.gl.attachShader(program, fragmentShaderSource);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS))
            throw this.gl.getProgramInfoLog(program);

        return program;
    }

    retrieveUniforms() {
        const uniformCount = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const uniformName = this.gl.getActiveUniform(this.program, i).name;
            this.uniforms[uniformName] = this.gl.getUniformLocation(this.program, uniformName);
        }
    }

    bind() {
        this.gl.useProgram(this.program);
    }
}

export default GLProgram;

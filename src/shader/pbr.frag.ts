export default `
precision highp float;

// Fragment shader output
out vec4 outFragColor;
in vec3 vNormalWS;
in vec3 vViewDirectionWS;

// Uniforms
struct Material
{
    vec3 albedo;
};
uniform Material uMaterial;

struct Lights
{
    vec3 color;
    float intensity;
    vec3 positionWS;
};
uniform Lights uLights[3];

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
    return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
    return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

void main()
{
    // **DO NOT** forget to do all your computation in linear space.
    vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;
    // vec3 albedo = sRGBToLinear(vec4(vNormalWS, 1.0)).rgb;
    // vec3 albedo = sRGBToLinear(vec4(vViewDirectionWS, 1.0)).rgb;

    vec3 accu = vec3(0.0);
    for (int i = 0; i < 3; i++)
    {
        accu += (uLights[i].intensity * uLights[i].color * abs(dot(uLights[i].positionWS, vNormalWS)));
    }

    accu.x = clamp(accu.x, 0.0, 1.0);
    accu.y = clamp(accu.y, 0.0, 1.0);
    accu.z = clamp(accu.z, 0.0, 1.0);

    albedo = albedo + accu;

    // **DO NOT** forget to apply gamma correction as last step.
    outFragColor.rgba = LinearTosRGB(vec4(albedo, 1.0));
}
`;

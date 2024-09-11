export default `
precision highp float;

// Fragment shader output
out vec4 outFragColor;
in vec3 vNormalWS;
in vec3 vViewDirectionWS;
in vec3 positionWS;

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

float pi = 3.1415;

float calculatePointLight(float intensity, vec3 normal, vec3 toLight)
{
    float len = length(toLight);
    return intensity * max(dot(normal, normalize(toLight)), 0.0) / (4.0 * pi * len * len);
}

void main()
{
    // **DO NOT** forget to do all your computation in linear space.
    vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;
    // vec3 albedo = sRGBToLinear(vec4(vNormalWS, 1.0)).rgb;
    // vec3 albedo = sRGBToLinear(vec4(vViewDirectionWS, 1.0)).rgb;

    vec3 accu = vec3(0.0);
    for (int i = 0; i < 2; i++)
    {
        accu += albedo * (uLights[i].color * calculatePointLight(uLights[i].intensity, vNormalWS, uLights[i].positionWS - positionWS));
    }

    albedo = accu;
    albedo = albedo / (albedo + vec3(1));

    // **DO NOT** forget to apply gamma correction as last step.
    outFragColor.rgba = LinearTosRGB(vec4(albedo, 1.0));
}
`;

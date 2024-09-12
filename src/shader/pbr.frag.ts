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

struct CameraFrag
{
    vec3 position;
};
uniform CameraFrag uCameraFrag;

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

vec3 ACESFilm(vec3 x)
{
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

vec3 diffuseBRDF(vec3 p)
{
    return p / pi;
}

float normalDistribution(vec3 halfway, float roughness)
{
    float roughnessSquare = roughness * roughness;
    float normalHalf = dot(vNormalWS, halfway);
    float ratio = normalHalf * normalHalf * (roughnessSquare - 1.0) + 1.0;

    return roughnessSquare / (pi * ratio * ratio);
}

float GGX(vec3 n, vec3 v, float k)
{
    return dot(n, v) / (dot(n, v) * (1.0 - k) + k);
}

float geometric(vec3 vue, vec3 light, float roughness)
{
    float k = ((roughness + 1.0) * (roughness + 1.0)) / 8.0;
    return GGX(vNormalWS, vue, k) * GGX(vNormalWS, light, k);
}

float roughness = 0.5;
float metallic = 0.0;

vec3 specularBRDF(vec3 p, vec3 w0, vec3 wi)
{
    vec3 halfway = wi + w0;
    halfway = normalize(halfway);
    return vec3((normalDistribution(halfway, roughness) * geometric(w0, wi, roughness)) / (4.0 * dot(w0, vNormalWS) * dot(wi, vNormalWS)));
}

void main()
{
    // **DO NOT** forget to do all your computation in linear space.
    vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;
    // vec3 albedo = sRGBToLinear(vec4(vNormalWS, 1.0)).rgb;
    // vec3 albedo = sRGBToLinear(vec4(vViewDirectionWS, 1.0)).rgb;

    float ks = 0.5;
    vec3 accu = vec3(0.0);
    for (int i = 0; i < 2; i++)
    {
        // accu += diffuseBRDF(albedo) * (uLights[i].color * calculatePointLight(uLights[i].intensity, vNormalWS, uLights[i].positionWS - positionWS));

        vec3 spec = ks * specularBRDF(albedo, uLights[i].positionWS - positionWS, uCameraFrag.position - positionWS);
        spec = normalize(spec);
        vec3 diffuse = (1.0 - ks) * diffuseBRDF(albedo);
        diffuse = normalize(diffuse);
        diffuse *= (1.0 - metallic);
        accu += (spec + diffuse) * albedo * (uLights[i].color * calculatePointLight(uLights[i].intensity, vNormalWS, uLights[i].positionWS - positionWS));
    }

    albedo = accu;
    // albedo = albedo / (albedo + vec3(1));
    albedo = ACESFilm(albedo);

    // **DO NOT** forget to apply gamma correction as last step.
    outFragColor.rgba = LinearTosRGB(vec4(albedo, 1.0));
}
`;

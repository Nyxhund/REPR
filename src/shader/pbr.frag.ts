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
    float roughness;
    float metalness;
};
uniform Material uMaterial;

uniform sampler2D uTextureDiffuse;
uniform sampler2D uTextureSpecular;
uniform sampler2D uTexturePreIntBRDF;

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
uniform Lights uLights[4];

struct Mode
{
    int mode;
    int tone;
};
uniform Mode uMode;

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

vec3 specularBRDF(vec3 p, vec3 w0, vec3 wi)
{
    vec3 halfway = wi + w0;
    halfway = normalize(halfway);
    float roughness = uMaterial.roughness;
    float metallic = uMaterial.metalness;

    float distrib = normalDistribution(halfway, roughness);
    float geo = geometric(w0, wi, roughness);
    return vec3((distrib * geo) / (4.0 * dot(w0, vNormalWS) * dot(wi, vNormalWS)));
}

vec3 fresnelShlick(vec3 vue, vec3 halfway, vec3 f0)
{
    return f0 + (1.0 - f0) * pow(1.0 - dot(vue, halfway), 5.0);
}

vec2 cartesianToPolar(vec3 cartesian) {
    // Compute azimuthal angle, in [-PI, PI]
    float phi = atan(cartesian.z, cartesian.x);

    // Compute polar angle, in [-PI/2, PI/2]
    float theta = asin(cartesian.y);

    return vec2(phi, theta);
}

vec3 RGBMDecode(vec4 rgbm) {
  return 6.0 * rgbm.rgb * rgbm.a;
}

vec4 diffuseIBL(vec3 normal)
{
    vec2 polar = cartesianToPolar(normal);
    polar.x = (polar.x + pi) / (2.0 * pi);
    polar.y = (polar.y + pi / 2.0) / pi;
    vec4 tmp = texture(uTextureDiffuse, polar);
    return vec4(RGBMDecode(tmp), 1.0);
}

vec3 BRDF(vec3 albedo)
{
    // VERSION BRDF
    vec3 accu = vec3(0.0);
    for (int i = 0; i < 4; i++)
    {
        // accu += diffuseBRDF(albedo) * (uLights[i].color * calculatePointLight(uLights[i].intensity, vNormalWS, uLights[i].positionWS - positionWS));

        vec3 vue = uCameraFrag.position - positionWS;
        vue = normalize(vue);
        vec3 wi = uLights[i].positionWS - positionWS;
        wi = normalize(wi);
        vec3 halfway = vue + wi;
        halfway = normalize(halfway);

        vec3 ks = fresnelShlick(vue, halfway, vec3(uMaterial.metalness));
        vec3 spec = ks * specularBRDF(albedo, vue, wi);

        vec3 diffuse = (1.0 - ks) * diffuseBRDF(albedo);
        diffuse = normalize(diffuse);
        diffuse *= (1.0 - uMaterial.metalness) * albedo;

        accu += (spec + diffuse) * (uLights[i].color * calculatePointLight(uLights[i].intensity, vNormalWS, uLights[i].positionWS - positionWS));
    }

    return accu;
}

vec2 getLevel(float x, vec2 polar)
{
    vec2 levelX = polar;
    levelX.x = (levelX.x + pi) / (pi * 2.0);
    levelX.y = (levelX.y + pi / 2.0) / pi;

    levelX.x = levelX.x * (1.0 / (pow(2.0, x)));
    levelX.y = levelX.y * (1.0 / (pow(2.0, x + 1.0))) + (1.0 - 1.0 / pow(2.0, x));

    return levelX;
}

vec4 computeTexelFromRoughness(float roughness, vec3 reflected)
{
    vec2 polar = cartesianToPolar(reflected);

    vec2 first = getLevel(floor(roughness * 6.0), polar);
    vec2 second = getLevel(ceil(roughness * 6.0), polar);

    vec4 texel1 = texture(uTextureSpecular, first);
    vec4 texel2 = texture(uTextureSpecular, second);

    vec4 texelConverted1 = vec4(RGBMDecode(texel1), 1.0);
    vec4 texelConverted2 = vec4(RGBMDecode(texel2), 1.0);

    return mix(texelConverted1, texelConverted2, roughness * 6.0 - floor(roughness * 6.0));
}

vec3 IBL(vec3 albedo)
{
    vec3 vue = uCameraFrag.position - positionWS;
    vue = normalize(vue);

    // Diffuse
    vec3 ks = fresnelShlick(vue, vNormalWS, vec3(uMaterial.metalness));
    vec3 kd = (1.0 - ks) * (1.0 - uMaterial.metalness);
    vec3 diffuseBRDFEval  = kd * albedo * diffuseIBL(vNormalWS).rgb;

    // Specular
    vec3 reflected = -reflect(vue, vNormalWS);

    vec4 prefilteredSpec = computeTexelFromRoughness(uMaterial.roughness, reflected);

    float u = max(0.0, dot(vue, vNormalWS));
    vec2 uv = vec2(u, uMaterial.roughness);

    vec4 brdf = texture(uTexturePreIntBRDF, uv);
    brdf = sRGBToLinear(brdf);
    vec3 specularBRDFEval = prefilteredSpec.rgb * (ks * brdf.r + brdf.g);

    return specularBRDFEval + diffuseBRDFEval;
}

void main()
{
    // **DO NOT** forget to do all your computation in linear space.
    vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;
    // vec3 albedo = sRGBToLinear(vec4(vNormalWS, 1.0)).rgb;
    // vec3 albedo = sRGBToLinear(vec4(vViewDirectionWS, 1.0)).rgb;

    if (uMode.mode == 0)
        albedo = BRDF(albedo);
    else
        albedo = IBL(albedo);

    if (uMode.tone == 0)
        albedo = ACESFilm(albedo);
    else
        albedo = albedo / (albedo + vec3(1));

    // **DO NOT** forget to apply gamma correction as last step.
    outFragColor.rgba = LinearTosRGB(vec4(albedo, 1.0));
}
`;

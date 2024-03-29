/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

precision mediump float;

uniform sampler2D u_Texture;
uniform sampler2D u_TextureEye;
uniform sampler2D u_TextureDudak;

uniform vec4 u_LightingParameters;
uniform vec4 u_MaterialParameters;
uniform vec4 u_ColorCorrectionParameters;

varying vec3 v_ViewPosition;
varying vec3 v_ViewNormal;
varying vec2 v_TexCoord;
uniform vec4 u_ObjColor;
uniform vec4 u_TintColor;
uniform vec4 u_TintColorEyes;
uniform vec4 u_TintColorDudak;

void main() {
  // We support approximate sRGB gamma.
  const float kGamma = 0.4545454;
  const float kInverseGamma = 2.2;
  const float kMiddleGrayGamma = 0.466;

  // Unpack lighting and material parameters for better naming.
  vec3 viewLightDirection = u_LightingParameters.xyz;
  vec3 colorShift = u_ColorCorrectionParameters.rgb;
  float averagePixelIntensity = u_ColorCorrectionParameters.a;

  float materialAmbient = u_MaterialParameters.x;
  float materialDiffuse = u_MaterialParameters.y;
  float materialSpecular = u_MaterialParameters.z;
  float materialSpecularPower = u_MaterialParameters.w;

  // Normalize varying parameters, because they are linearly interpolated in the vertex shader.
  vec3 viewFragmentDirection = normalize(v_ViewPosition);
  vec3 viewNormal = normalize(v_ViewNormal);

  // Flip the y-texture coordinate to address the texture from top-left.
  vec4 objectColorContour = texture2D(u_Texture, vec2(v_TexCoord.x, 1.0 - v_TexCoord.y));
  vec4 objectColorEye = texture2D(u_TextureEye, vec2(v_TexCoord.x, 1.0 - v_TexCoord.y));
  vec4 objectColorDudak = texture2D(u_TextureDudak, vec2(v_TexCoord.x, 1.0 - v_TexCoord.y));

  objectColorContour.rgb = objectColorContour.rgb * u_TintColor.rgb;
  objectColorEye.rgb = objectColorEye.rgb * u_TintColorEyes.rgb;
  objectColorDudak.rgb = objectColorDudak.rgb * u_TintColorDudak.rgb;
  vec4 objectColor = objectColorContour + objectColorEye + objectColorDudak;

  // Apply color to grayscale image only if the alpha of u_ObjColor is
  // greater and equal to 255.0.
  objectColor.rgb *= mix(vec3(1.0), u_ObjColor.rgb / 255.0,
                         step(255.0, u_ObjColor.a));

  // Apply inverse SRGB gamma to the texture before making lighting calculations.
  objectColor.rgb = pow(objectColor.rgb, vec3(kInverseGamma));


  // Ambient light is unaffected by the light intensity.
  float ambient = materialAmbient;

  // Approximate a hemisphere light (not a harsh directional light).
  float diffuse = materialDiffuse *
          0.5 * (dot(viewNormal, viewLightDirection) + 1.0);

  // Compute specular light.
  vec3 reflectedLightDirection = reflect(viewLightDirection, viewNormal);
  float specularStrength = max(0.0, dot(viewFragmentDirection, reflectedLightDirection));
  float specular = materialSpecular *
          pow(specularStrength, materialSpecularPower);

  vec3 color = objectColor.rgb * (ambient + diffuse) + specular;
  // Apply SRGB gamma before writing the fragment color.
  color.rgb = pow(color, vec3(kGamma));
  // Apply average pixel intensity and color shift
  color *= colorShift * (averagePixelIntensity / kMiddleGrayGamma);
  gl_FragColor.rgb = color;
  gl_FragColor.a = objectColor.a;
}
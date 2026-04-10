{ pkgs ? import <nixpkgs> {} }:

let
  version = "0.2.8";

  repo = "systemsway-prod/sdlc";
  releaseTag = "cliv${version}";
  binaryName = "sdlc-components-build";

  releaseUrl = "https://github.com/${repo}/releases/download/${releaseTag}/${binaryName}";

  sdlc-components-build = pkgs.runCommand "${binaryName}-${version}" {} ''
    mkdir -p $out/bin
    install -m755 ${builtins.fetchurl { url = releaseUrl; }} $out/bin/${binaryName}
  '';
in

pkgs.mkShell {
  buildInputs = [
    pkgs.bun
    pkgs.nodejs_20
    sdlc-components-build
  ];
}

#!/usr/bin/env bash

slidev() {
  local -a args=("$@") mounts=()
  local -A mounted=()
  local command_name="" path dir value option
  local i next_is_value=0

  case "${args[0]:-}" in
    build|export|export-notes|format|mcp)
      command_name="${args[0]}"
      ;;
    *)
      command_name="dev"
      ;;
  esac

  mounts=(-v "$PWD:/work:Z")
  mounted["$PWD"]=1

  _slidev_mount() {
    local target="$1"
    local directory

    directory="$(dirname -- "$target")"

    if [[ ! -d "$directory" ]]; then
      printf 'Dizin bulunamadi: %s\\n' "$directory" >&2
      return 1
    fi

    if [[ -z "${mounted[$directory]+x}" ]]; then
      mounts+=(-v "$directory:$directory:Z")
      mounted["$directory"]=1
    fi
  }

  for ((i=0; i<${#args[@]}; i++)); do
    option="${args[i]}"

    case "$option" in
      --output|--out|-o)
        if ((i+1 >= ${#args[@]})); then
          printf 'Eksik cikti yolu: %s\\n' "$option" >&2
          return 1
        fi

        value="${args[i+1]}"
        path="$(realpath -m -- "$value")"

        _slidev_mount "$path" || return 1

        if [[ "$option" == "--out" || "$option" == "-o" ]]; then
          if [[ "$(dirname -- "$path")" == "$PWD" ]]; then
            args[i+1]="/work/$(basename -- "$path")"
          else
            args[i+1]="$path"
          fi
        fi

        ((i++))
        ;;
      --output=*|--out=*)
        value="${option#*=}"
        path="$(realpath -m -- "$value")"

        _slidev_mount "$path" || return 1

        if [[ "$option" == --out=* ]]; then
          args[i]="--out=$path"
        fi
        ;;
      -*)
        ;;
      *.md)
        path="$(realpath -m -- "$option")"

        if [[ ! -f "$path" ]]; then
          printf 'Markdown bulunamadi: %s\\n' "$path" >&2
          return 1
        fi

        _slidev_mount "$path" || return 1
        ;;
    esac
  done

  unset -f _slidev_mount

  local -a ports=()
  if [[ "$command_name" == "dev" ]]; then
    ports=(-p 3030:3030)
    if [[ " ${args[*]} " != *" --remote "* ]]; then
      args+=(--remote)
    fi
    if [[ " ${args[*]} " != *" --bind "* ]]; then
      args+=(--bind 0.0.0.0)
    fi
  fi

  docker run --rm -it \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    "${mounts[@]}" \
    -w /work \
    "${ports[@]}" \
    orioninsist-slidev:latest "${args[@]}"
}

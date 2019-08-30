// A simple 2D mask (2D matrix of booleans) stored as a row-major flat array.
class Mask2D {
  private data: boolean[];

  public constructor(private width: number, height: number) {
    this.data = new Array(width * height);
  }

  public get(x: number, y: number): boolean {
    return this.data[y * this.width + x];
  }

  public set(x: number, y: number, v: boolean) {
    this.data[y * this.width + x] = v;
  }

  public clear() {
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = false;
    }
  }
}

export function greedyMesh(
  getVoxelBoundsChecked: (x: number, y: number, z: number) => boolean,
  dims: [number, number, number]
) {
  var quads = [];

  // Sweep over 3-axes. `norm` is a number from [0, 3) which is used as an array
  // selection into a [x, y, z] vector3. Aka `norm` sweeps across the three
  // euclidean axises.
  for (let norm = 0; norm < 3; norm++) {
    // The tangent and bitangent axises. If you think of `norm` as the 'forward'
    // vector then `tan` is the 'right' vector, and `biTan` is the 'down'
    // vector. Again, each of these are just selectors into a [x, y, z] Vector3.
    const tan = (norm + 1) % 3;
    const biTan = (norm + 2) % 3;

    // The normal vector3, as a number triple (ideally you would replace this
    // with a THREE.Vector3 or something).
    const normalVector: [number, number, number] = [0, 0, 0];
    normalVector[norm] = 1;

    // Explained below.
    const mask = new Mask2D(dims[tan], dims[biTan]);

    // Move through the volume in 2D 'slices' perpendicular to the
    // `normal_vector`.
    for (let slice = 0; slice < dims[norm]; slice++) {
      // A 'voxel cursor' used to sample the 'slice' in the correct euclidean
      // plane.
      const cursor: [number, number, number] = [0, 0, 0];
      cursor[norm] = slice;

      // Compute the 2D mask of which voxels need to be tessellated.
      for (cursor[biTan] = 0; cursor[biTan] < dims[biTan]; ++cursor[biTan]) {
        for (cursor[tan] = 0; cursor[tan] < dims[tan]; ++cursor[tan]) {
          // The mask is set to true anywhere a voxel in the current 'slice`
          // differs from a voxel in the previous 'slice' in the
          // `-normalVector` direction. Aka anywhere a solid voxel face touches
          // a non-solid voxel. Note that this will cause sampling of
          // non-existent negative voxel coordinates, which
          // `getVoxelBoundsChecked` needs to handle by returning false.
          const voxelInSlice = getVoxelBoundsChecked(...cursor);
          const voxelInPreviousSlice = getVoxelBoundsChecked(
            cursor[0] - normalVector[0],
            cursor[1] - normalVector[1],
            cursor[2] - normalVector[2]
          );
          mask.set(
            cursor[tan],
            cursor[biTan],
            voxelInSlice !== voxelInPreviousSlice
          );
        }
      }

      // Generate mesh for mask using lexicographic ordering
      for (let y = 0; y < dims[biTan]; y++) {
        for (let x = 0; x < dims[tan]; ) {
          // If the mask isn't set, then just increment and continue (nothing to
          // tessellate).
          if (!mask.get(x, y)) {
            x++;
            continue;
          }

          // Compute the max-width of the combined quad going left-to-right.
          let width = 1;
          while (mask.get(x + width, y) && x + width < dims[tan]) {
            width++;
          }

          // Compute max-height (extend the row `width` downward as much as
          // possible).
          let height = 1;
          outer: for (; y + height < dims[biTan]; height++) {
            for (let k = x; k < width; k++) {
              if (!mask.get(k, y + height)) {
                break outer;
              }
            }
          }

          // The base of the quad to add
          const b = [0, 0, 0];
          b[norm] = slice;
          b[tan] = x;
          b[biTan] = y;

          // The 'width' of the quad.
          const du = [0, 0, 0];
          du[tan] = width;

          // The 'height' of the quad.
          const dv = [0, 0, 0];
          dv[biTan] = height;

          quads.push([
            [b[0], b[1], b[2]],
            [b[0] + du[0], b[1] + du[1], b[2] + du[2]],
            [b[0] + du[0] + dv[0], b[1] + du[1] + dv[1], b[2] + du[2] + dv[2]],
            [b[0] + dv[0], b[1] + dv[1], b[2] + dv[2]],
          ]);

          // Clear the mask and increment x by the width of this quad.
          mask.clear();
          x += width;
        }
      }
    }
  }
  return quads;
}

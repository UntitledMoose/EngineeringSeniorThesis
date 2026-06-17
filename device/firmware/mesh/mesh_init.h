#ifndef MESH_INIT_H
#define MESH_INIT_H

#include <zephyr/bluetooth/mesh.h>

int mesh_init(void);

bool mesh_is_provisioned(void);

int mesh_self_provision(void);

void mesh_reset(void);

const struct bt_mesh_comp *mesh_get_comp(void);

const struct bt_mesh_prov *mesh_get_prov(void);

#endif /* MESH_INIT_H */

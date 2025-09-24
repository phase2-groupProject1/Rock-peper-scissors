"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.Move, {
        as: "MovesAsPlayer1",
        foreignKey: "User_id_1",
      });
      this.hasMany(models.Move, {
        as: "MovesAsPlayer2",
        foreignKey: "User_id_2",
      });
    }
  }
  User.init(
    {
      username: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "User",
    }
  );
  return User;
};
